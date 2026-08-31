export const TASK_STATUSES = ['todo', 'in-progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface TaskDraft {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  labels: string[];
}

export interface Task extends TaskDraft {
  id: string;
  key: string;
  position: number;
}

export interface PageInfo {
  nextToken?: string;
  previousToken?: string;
}

export interface MoveTaskResult {
  task: Task;
  previousStatus: TaskStatus;
  affectedTasks: Task[];
}
