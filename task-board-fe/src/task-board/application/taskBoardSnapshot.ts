import { TASK_STATUSES, type Task, type TaskStatus } from '../domain/task'
import type { MoveTaskResult } from './ports/TaskCommands'
import type { TaskBoardSnapshot, TaskPage } from './ports/TaskQueries'

export function getLoadedTasks(taskBoard: TaskBoardSnapshot): Task[] {
  return TASK_STATUSES.flatMap((status) => taskBoard[status].items)
}

export function isTaskBoardExhaustive(taskBoard: TaskBoardSnapshot): boolean {
  return TASK_STATUSES.every((status) =>
    isTaskPageExhaustive(taskBoard[status]),
  )
}

export const transitionLoadedTasks = (
  taskBoard: TaskBoardSnapshot,
  tasks: Task[],
): TaskBoardSnapshot => {
  return {
    todo: transitionPage(taskBoard.todo, loadedTasksByStatus(tasks, 'todo')),
    'in-progress': transitionPage(
      taskBoard['in-progress'],
      loadedTasksByStatus(tasks, 'in-progress'),
    ),
    done: transitionPage(taskBoard.done, loadedTasksByStatus(tasks, 'done')),
  }
}

export const previewLoadedTaskAtIndex = (
  tasks: Task[],
  taskId: string,
  targetStatus: TaskStatus,
  targetIndex: number,
): Task[] => {
  const moved = tasks.find((task) => task.id === taskId)
  if (moved === undefined) return tasks
  const withoutMoved = tasks.filter((task) => task.id !== taskId)
  const targetTasks = loadedTasksByStatus(withoutMoved, targetStatus)
  targetTasks.splice(
    Math.max(0, Math.min(targetIndex, targetTasks.length)),
    0,
    { ...moved, status: targetStatus },
  )
  return TASK_STATUSES.flatMap((status) =>
    status === targetStatus
      ? targetTasks
      : loadedTasksByStatus(withoutMoved, status),
  )
}

export const previewLoadedTaskBefore = (
  tasks: Task[],
  taskId: string,
  anchorTaskId: string,
): Task[] => {
  const anchor = tasks.find((task) => task.id === anchorTaskId)
  if (anchor === undefined) return tasks
  const withoutMoved = tasks.filter((task) => task.id !== taskId)
  const anchorIndex = loadedTasksByStatus(
    withoutMoved,
    anchor.status,
  ).findIndex((task) => task.id === anchor.id)
  if (anchorIndex < 0) return tasks
  return previewLoadedTaskAtIndex(tasks, taskId, anchor.status, anchorIndex)
}

export function mergeCreatedTask(
  taskBoard: TaskBoardSnapshot,
  task: Task,
): TaskBoardSnapshot {
  const wasLoaded = findLoadedTaskStatus(taskBoard, task.id) !== undefined
  return reconcileTask(taskBoard, task, {
    includeInLoadedItems: true,
    totalChanges: wasLoaded ? {} : singleStatusTotalChange(task.status, 1),
  })
}

export function mergeUpdatedTask(
  taskBoard: TaskBoardSnapshot,
  previous: Task,
  updated: Task,
): TaskBoardSnapshot {
  const loadedStatus = findLoadedTaskStatus(taskBoard, updated.id)
  const wasLoaded = loadedStatus !== undefined
  const wasExhaustive = isTaskBoardExhaustive(taskBoard)
  return reconcileTask(taskBoard, updated, {
    includeInLoadedItems: wasLoaded || wasExhaustive,
    totalChanges:
      !wasLoaded && wasExhaustive
        ? singleStatusTotalChange(updated.status, 1)
        : statusTotalChanges(loadedStatus ?? previous.status, updated.status),
  })
}

export const isTaskPageExhaustive = (page: TaskPage): boolean => {
  return (
    page.items.length === page.totalCount &&
    page.pageInfo.nextToken === undefined &&
    page.pageInfo.previousToken === undefined
  )
}

export interface TaskPageBoundaries {
  readonly startKnown: boolean
  readonly endKnown: boolean
}

export const getTaskPageBoundaries = (page: TaskPage): TaskPageBoundaries => {
  const exhaustive = isTaskPageExhaustive(page)
  return {
    startKnown:
      exhaustive ||
      (page.pageInfo.previousToken === undefined &&
        page.pageInfo.nextToken !== undefined),
    endKnown:
      exhaustive ||
      (page.pageInfo.nextToken === undefined &&
        page.pageInfo.previousToken !== undefined),
  }
}

export const reconcileMovedTask = (
  taskBoard: TaskBoardSnapshot,
  result: MoveTaskResult,
): TaskBoardSnapshot => {
  const loadedIds = new Set(getLoadedTasks(taskBoard).map((task) => task.id))
  const sourceStatus =
    findLoadedTaskStatus(taskBoard, result.task.id) ?? result.previousStatus
  const affectedStatuses = new Set([sourceStatus, result.task.status])
  const reconcileStatus = (status: Task['status']): TaskPage => {
    const page = taskBoard[status]
    if (!affectedStatuses.has(status)) return page
    const items =
      status === result.task.status
        ? result.affectedTasks
            .filter(
              (task) =>
                task.status === status &&
                (loadedIds.has(task.id) || task.id === result.task.id),
            )
            .sort((left, right) => left.position - right.position)
        : page.items.filter((task) => task.id !== result.task.id)
    const totalCount = movedTotalCount(
      page.totalCount,
      status,
      sourceStatus,
      result.task.status,
    )
    if (sameMovedItems(page.items, items) && page.totalCount === totalCount) {
      return page
    }
    return {
      items,
      totalCount,
      pageInfo: {},
    }
  }
  return {
    todo: reconcileStatus('todo'),
    'in-progress': reconcileStatus('in-progress'),
    done: reconcileStatus('done'),
  }
}

const transitionPage = (page: TaskPage, items: Task[]): TaskPage => {
  if (hasSameItems(page.items, items)) return page
  return {
    items,
    totalCount: page.totalCount + items.length - page.items.length,
    pageInfo: {},
  }
}

interface ReconciliationOptions {
  readonly includeInLoadedItems: boolean
  readonly totalChanges: Partial<Record<Task['status'], number>>
}

const reconcileTask = (
  taskBoard: TaskBoardSnapshot,
  task: Task,
  options: ReconciliationOptions,
): TaskBoardSnapshot => {
  return {
    todo: reconcilePage(taskBoard.todo, task, 'todo', options),
    'in-progress': reconcilePage(
      taskBoard['in-progress'],
      task,
      'in-progress',
      options,
    ),
    done: reconcilePage(taskBoard.done, task, 'done', options),
  }
}

const reconcilePage = (
  page: TaskPage,
  task: Task,
  status: Task['status'],
  options: ReconciliationOptions,
): TaskPage => {
  const withoutTask = page.items.filter((candidate) => candidate.id !== task.id)
  const shouldInclude = options.includeInLoadedItems && status === task.status
  const items = shouldInclude ? [...withoutTask, task] : withoutTask
  const totalCount = Math.max(
    0,
    page.totalCount + (options.totalChanges[status] ?? 0),
  )
  if (hasSameItems(page.items, items) && page.totalCount === totalCount) {
    return page
  }
  return {
    items,
    totalCount,
    pageInfo: {},
  }
}

const statusTotalChanges = (
  previousStatus: Task['status'],
  updatedStatus: Task['status'],
): ReconciliationOptions['totalChanges'] => {
  if (previousStatus === updatedStatus) return {}
  return { [previousStatus]: -1, [updatedStatus]: 1 }
}

const findLoadedTaskStatus = (
  taskBoard: TaskBoardSnapshot,
  taskId: string,
): Task['status'] | undefined => {
  return TASK_STATUSES.find((status) =>
    taskBoard[status].items.some((task) => task.id === taskId),
  )
}

const hasSameItems = (
  current: readonly Task[],
  next: readonly Task[],
): boolean => {
  return (
    current.length === next.length &&
    current.every((task, index) => task === next[index])
  )
}

const singleStatusTotalChange = (
  status: Task['status'],
  change: number,
): ReconciliationOptions['totalChanges'] => {
  return { [status]: change }
}

const movedTotalCount = (
  totalCount: number,
  status: Task['status'],
  previousStatus: Task['status'],
  targetStatus: Task['status'],
): number => {
  if (previousStatus === targetStatus) return totalCount
  if (status === previousStatus) return Math.max(0, totalCount - 1)
  if (status === targetStatus) return totalCount + 1
  return totalCount
}

const loadedTasksByStatus = (
  tasks: readonly Task[],
  status: TaskStatus,
): Task[] => tasks.filter((task) => task.status === status)

const sameMovedItems = (current: readonly Task[], next: readonly Task[]) => {
  return (
    current.length === next.length &&
    current.every((task, index) => {
      const candidate = next[index]
      return (
        candidate !== undefined &&
        task.id === candidate.id &&
        task.status === candidate.status &&
        task.position === candidate.position
      )
    })
  )
}
