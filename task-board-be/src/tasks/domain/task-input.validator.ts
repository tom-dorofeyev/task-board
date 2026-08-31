import { ApplicationError } from '../../shared/application-error.js';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskDraft,
  type TaskPriority,
  type TaskStatus,
} from './task.js';

const TASK_DRAFT_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'assignee',
  'labels',
];

export function taskStatusFrom(value: unknown): TaskStatus {
  if (typeof value !== 'string' || !TASK_STATUSES.includes(value as TaskStatus))
    throw new ApplicationError(400, 'Invalid task status');
  return value as TaskStatus;
}

export function taskPriorityFrom(value: unknown): TaskPriority {
  if (
    typeof value !== 'string' ||
    !TASK_PRIORITIES.includes(value as TaskPriority)
  )
    throw new ApplicationError(400, 'Invalid task priority');
  return value as TaskPriority;
}

export function taskDraftFrom(value: unknown): TaskDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApplicationError(400, 'task must be an object');
  const input = value as Record<string, unknown>;
  assertExactTaskFields(input);
  return {
    title: requiredString(input.title, 'title'),
    description: stringValue(input.description, 'description'),
    status: taskStatusFrom(input.status),
    priority: taskPriorityFrom(input.priority),
    assignee: requiredString(input.assignee, 'assignee'),
    labels: labelsFrom(input.labels),
  };
}

function assertExactTaskFields(input: Record<string, unknown>): void {
  const hasUnknownField = Object.keys(input).some(
    (key) => !TASK_DRAFT_FIELDS.includes(key),
  );
  const hasMissingField = TASK_DRAFT_FIELDS.some(
    (field) => !Object.hasOwn(input, field),
  );
  if (
    hasUnknownField ||
    hasMissingField ||
    Object.keys(input).length !== TASK_DRAFT_FIELDS.length
  )
    throw new ApplicationError(400, 'All task fields are required');
}

function labelsFrom(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.some((label) => typeof label !== 'string' || !label.trim()) ||
    new Set(value).size !== value.length
  )
    throw new ApplicationError(
      400,
      'labels must contain unique non-empty strings',
    );
  return [...value];
}

export function requiredString(value: unknown, field: string): string {
  const string = stringValue(value, field);
  if (!string.trim()) throw new ApplicationError(400, `${field} is required`);
  return string;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new ApplicationError(400, `${field} must be a string`);
  return value;
}

export function assertValidListQuery(query: Record<string, unknown>): void {
  if (
    (query.sort !== undefined && query.sort !== 'board-order') ||
    (query.filterIdentity !== undefined && query.filterIdentity !== 'all')
  )
    throw new ApplicationError(400, 'Invalid task query');
}
