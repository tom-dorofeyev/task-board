import { useCallback, useRef, useState } from 'react'
import type { MoveTaskInput } from '../../application/ports/TaskCommands'
import type { TaskBoardSnapshot } from '../../application/ports/TaskQueries'
import {
  getLoadedTasks,
  getTaskPageBoundaries,
  previewLoadedTaskAtIndex,
  previewLoadedTaskBefore,
  reconcileMovedTask,
  transitionLoadedTasks,
} from '../../application/taskBoardSnapshot'
import type { MoveTask } from '../../application/use-cases/MoveTask'
import { COLUMN_TITLES, type Task, type TaskStatus } from '../../domain/task'

export type MutationRunner = (
  operation: () => Promise<void>,
) => Promise<boolean>

export function useMutationLock() {
  const active = useRef(false)
  const [isMutationPending, setMutationPending] = useState(false)
  const runMutation = useCallback<MutationRunner>(async (operation) => {
    if (active.current) return false
    active.current = true
    setMutationPending(true)
    try {
      await operation()
    } finally {
      active.current = false
      setMutationPending(false)
    }
    return true
  }, [])
  return { isMutationPending, runMutation }
}

export function useTaskBoardMoves(options: {
  taskBoard: TaskBoardSnapshot
  onTaskBoardChange(taskBoard: TaskBoardSnapshot): void
  moveTask: MoveTask
  runMutation: MutationRunner
  onAnnouncement(message: string): void
  onError(message: string | null): void
}) {
  const {
    taskBoard,
    onTaskBoardChange,
    moveTask,
    runMutation,
    onAnnouncement,
    onError,
  } = options
  const tasks = getLoadedTasks(taskBoard)

  const persistMove = async (
    taskId: string,
    status: TaskStatus,
    position: number,
  ) => {
    if (position < 0 && !getTaskPageBoundaries(taskBoard[status]).startKnown) {
      onAnnouncement('Load more tasks before moving across this boundary.')
      return
    }
    const movedTasks = previewLoadedTaskAtIndex(tasks, taskId, status, position)
    const input = resolvePositionMove(taskBoard, movedTasks, taskId, status)
    if (input === null) {
      onAnnouncement('Load more tasks before moving across this boundary.')
      return
    }
    await persistMoveCommand(input, movedTasks, COLUMN_TITLES[status])
  }

  const persistMoveBefore = async (taskId: string, targetTaskId: string) => {
    const target = tasks.find((task) => task.id === targetTaskId)
    if (target === undefined) return
    await persistMoveCommand(
      { taskId, targetStatus: target.status, beforeTaskId: targetTaskId },
      previewLoadedTaskBefore(tasks, taskId, targetTaskId),
      COLUMN_TITLES[target.status],
    )
  }

  const persistMoveCommand = async (
    input: MoveTaskInput,
    movedTasks: Task[],
    destination: string,
  ) => {
    await runMutation(async () => {
      const previousBoard = taskBoard
      onTaskBoardChange(transitionLoadedTasks(taskBoard, movedTasks))
      try {
        const result = await moveTask.execute(input)
        onTaskBoardChange(reconcileMovedTask(previousBoard, result))
        onAnnouncement(`${result.task.key} moved to ${destination}`)
        onError(null)
      } catch {
        onTaskBoardChange(previousBoard)
        onError('The task could not be moved. Your board was restored.')
      }
    })
  }

  return { persistMove, persistMoveBefore }
}

function resolvePositionMove(
  taskBoard: TaskBoardSnapshot,
  movedTasks: Task[],
  taskId: string,
  targetStatus: TaskStatus,
): MoveTaskInput | null {
  const targetTasks = movedTasks.filter((task) => task.status === targetStatus)
  const movedIndex = targetTasks.findIndex((task) => task.id === taskId)
  if (movedIndex < 0) return null
  const beforeTaskId = targetTasks[movedIndex + 1]?.id ?? null
  if (
    beforeTaskId === null &&
    !getTaskPageBoundaries(taskBoard[targetStatus]).endKnown
  ) {
    return null
  }
  return { taskId, targetStatus, beforeTaskId }
}
