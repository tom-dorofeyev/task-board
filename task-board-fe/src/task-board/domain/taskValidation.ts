import { TASK_PRIORITIES, TASK_STATUSES, type Task } from './task'

export type TaskDraft = Pick<
  Task,
  'title' | 'description' | 'status' | 'priority' | 'assignee' | 'labels'
>

export function createEmptyTaskDraft(): TaskDraft {
  return {
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee: '',
    labels: [],
  }
}

export function validateTaskDraft(draft: TaskDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.title.trim()) errors.title = 'Title is required.'
  if (!draft.assignee.trim()) errors.assignee = 'Assignee is required.'
  if (!TASK_STATUSES.includes(draft.status))
    errors.status = 'Choose a valid status.'
  if (!TASK_PRIORITIES.includes(draft.priority))
    errors.priority = 'Choose a valid priority.'
  return errors
}

export function normalizeTaskDraft(draft: TaskDraft): TaskDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    assignee: draft.assignee.trim(),
    labels: draft.labels,
  }
}

export class TaskDraftValidationError extends Error {
  readonly errors: Readonly<Record<string, string>>

  constructor(errors: Readonly<Record<string, string>>) {
    super('Task draft is invalid')
    this.name = 'TaskDraftValidationError'
    this.errors = errors
  }
}

export function normalizeValidTaskDraft(draft: TaskDraft): TaskDraft {
  const normalized = normalizeTaskDraft(draft)
  const errors = validateTaskDraft(normalized)
  if (Object.keys(errors).length > 0) throw new TaskDraftValidationError(errors)
  return normalized
}
