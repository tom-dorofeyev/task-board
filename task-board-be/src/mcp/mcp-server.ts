import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../tasks/domain/task.js';
import { taskDraftFrom } from '../tasks/domain/task-input.validator.js';
import {
  TaskBoardApiClient,
  TaskBoardApiError,
} from './task-board-api.client.js';

const taskStatus = z.enum(TASK_STATUSES);
const taskPriority = z.enum(TASK_PRIORITIES);
const requiredString = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank');
const taskDraft = z
  .object({
    title: requiredString,
    description: z.string(),
    status: taskStatus,
    priority: taskPriority,
    assignee: requiredString,
    labels: z.array(z.string()),
  })
  .strict()
  .superRefine((draft, context) => {
    try {
      taskDraftFrom(draft);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'Invalid task',
      });
    }
  });

export function createTaskBoardMcpServer(api: TaskBoardApiClient): McpServer {
  const server = new McpServer({ name: 'task-board-mcp', version: '1.0.0' });
  registerTools(server, api);
  return server;
}

export async function startTaskBoardMcpServer(): Promise<void> {
  const baseUrl = process.env.TASK_BOARD_API_URL;
  if (!baseUrl) throw new Error('TASK_BOARD_API_URL is required');
  const server = createTaskBoardMcpServer(
    new TaskBoardApiClient(baseUrl, process.env.TASK_BOARD_SESSION_COOKIE),
  );
  await server.connect(new StdioServerTransport());
}

function registerTools(server: McpServer, api: TaskBoardApiClient): void {
  server.registerTool(
    'task_board_whoami',
    { description: 'Resolve the authenticated Task Board user.' },
    () => toolResult(api.whoami()),
  );
  server.registerTool(
    'task_board_list_tasks',
    {
      description: 'List one ordered task status column.',
      inputSchema: z.object({
        status: taskStatus,
        sort: z.literal('board-order').optional(),
        filterIdentity: z.string().optional(),
        continuationToken: z.string().optional(),
      }),
    },
    (input) => toolResult(api.listTasks(input)),
  );
  server.registerTool(
    'task_board_get_task',
    {
      description: 'Get an accessible task by ID.',
      inputSchema: z.object({ taskId: requiredString }),
    },
    ({ taskId }) => toolResult(api.getTask(taskId)),
  );
  server.registerTool(
    'task_board_create_task',
    {
      description: 'Create a task idempotently.',
      inputSchema: z.object({
        idempotencyKey: requiredString,
        task: taskDraft,
      }),
    },
    (input) => toolResult(api.createTask(input)),
  );
  server.registerTool(
    'task_board_update_task',
    {
      description: 'Replace all editable task fields.',
      inputSchema: z.object({ taskId: requiredString, task: taskDraft }),
    },
    ({ taskId, task }) => toolResult(api.updateTask(taskId, task)),
  );
  server.registerTool(
    'task_board_move_task',
    {
      description: 'Move a task before an anchor or append it.',
      inputSchema: z.object({
        taskId: requiredString,
        targetStatus: taskStatus,
        beforeTaskId: z.string().nullable(),
      }),
    },
    (input) => toolResult(api.moveTask(input)),
  );
}

async function toolResult(operation: Promise<unknown>) {
  try {
    const result = await operation;
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (error) {
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(toToolError(error)) },
      ],
      isError: true,
    };
  }
}

function toToolError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  if (error instanceof TaskBoardApiError)
    return { status: error.status, code: error.code, message: error.message };
  return {
    status: 502,
    code: 'api_unavailable',
    message: 'The Task Board API could not be reached',
  };
}
