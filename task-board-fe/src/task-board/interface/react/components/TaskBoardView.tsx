import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { TaskBoardSnapshot } from '../../../application/ports/TaskQueries'
import type { TaskBoardPageWindows } from '../../../application/taskPageWindow'
import {
  getLoadedTasks,
  getTaskPageBoundaries,
} from '../../../application/taskBoardSnapshot'
import type { CreateTask } from '../../../application/use-cases/CreateTask'
import type { UpdateTask } from '../../../application/use-cases/UpdateTask'
import type { MoveTask } from '../../../application/use-cases/MoveTask'
import { TASK_STATUSES, type Task } from '../../../domain/task'
import type { TaskDraft } from '../../../domain/taskValidation'
import { useMutationLock, useTaskBoardMoves } from '../useTaskBoardMutations'
import { TaskDetailsDialog } from './TaskDetailsDialog'
import { TaskStatusColumn } from './TaskStatusColumn'

interface TaskBoardViewProps {
  taskBoard: TaskBoardSnapshot
  pageWindows: TaskBoardPageWindows
  taskId: string | undefined
  isCreateRoute: boolean
  createIdempotencyKey: string
  newTaskDraft: TaskDraft | null
  taskDetails: TaskDetailsState
  onTaskBoardChange(taskBoard: TaskBoardSnapshot): void
  onTaskCreated(task: Task): void
  onTaskUpdated(previous: Task, updated: Task): void
  onOpenTask(task: Task): void
  onCreateTask(): void
  onCloseTask(): void
  createTaskUseCase: CreateTask
  updateTask: UpdateTask
  moveTaskUseCase: MoveTask
}

export type TaskDetailsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; task: Task }
  | { status: 'not-found' }
  | { status: 'error' }

export function TaskBoardView({
  taskBoard,
  pageWindows,
  taskId,
  isCreateRoute,
  createIdempotencyKey,
  newTaskDraft,
  taskDetails,
  onTaskBoardChange,
  onTaskCreated,
  onTaskUpdated,
  onOpenTask,
  onCreateTask,
  onCloseTask,
  createTaskUseCase,
  updateTask: updateTaskUseCase,
  moveTaskUseCase,
}: TaskBoardViewProps) {
  const tasks = getLoadedTasks(taskBoard)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const hasOpenTask = newTaskDraft !== null || taskId !== undefined
  const { isMutationPending, runMutation } = useMutationLock()
  const { persistMove, persistMoveBefore } = useTaskBoardMoves({
    taskBoard,
    onTaskBoardChange,
    moveTask: moveTaskUseCase,
    runMutation,
    onAnnouncement: setAnnouncement,
    onError: setSaveError,
  })

  const saveTask = async (draft: TaskDraft) => {
    await runMutation(async () => {
      try {
        if (isCreateRoute) {
          onTaskCreated(
            await createTaskUseCase.execute({
              idempotencyKey: createIdempotencyKey,
              task: draft,
            }),
          )
        } else if (taskDetails.status === 'ready') {
          onTaskUpdated(
            taskDetails.task,
            await updateTaskUseCase.execute({
              id: taskDetails.task.id,
              task: draft,
            }),
          )
        } else {
          return
        }
        setSaveError(null)
        onCloseTask()
      } catch {
        setSaveError('Your changes could not be saved. Please try again.')
      }
    })
  }

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div>
          <span className="eyebrow">NEXUS WORKSPACE</span>
          <h1>Product roadmap</h1>
          <p>Shape ideas, keep momentum, and move the work that matters.</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={onCreateTask}
          disabled={isMutationPending}
        >
          <span aria-hidden="true">＋</span> Create task
        </button>
      </header>
      <section className="board" aria-label="Product roadmap task board">
        <p className="sr-only" id="board-boundary-instructions">
          Moves beyond loaded tasks are unavailable until more tasks are loaded.
        </p>
        <p className="sr-only" id="move-instructions">
          Use left and right arrows to change column, or up and down arrows to
          reorder.
        </p>
        {TASK_STATUSES.map((status) => (
          <TaskStatusColumn
            key={status}
            status={status}
            tasks={tasks}
            pageWindow={pageWindows[status]}
            canMoveTasks={!isMutationPending}
            canDropAtEnd={
              !isMutationPending &&
              getTaskPageBoundaries(pageWindows[status].page).endKnown
            }
            hasUnloadedBoundary={
              !getTaskPageBoundaries(pageWindows[status].page).startKnown ||
              !getTaskPageBoundaries(pageWindows[status].page).endKnown
            }
            onOpenTask={onOpenTask}
            onMoveTask={(taskId, targetStatus, position) =>
              void persistMove(taskId, targetStatus, position)
            }
            onMoveTaskBefore={(taskId, targetTaskId) =>
              void persistMoveBefore(taskId, targetTaskId)
            }
          />
        ))}
      </section>
      {shouldShowBoardError(saveError, hasOpenTask) && (
        <p className="board-error" role="alert">
          {saveError}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {newTaskDraft && (
        <TaskDetailsDialog
          task={newTaskDraft}
          mode="create"
          error={saveError}
          disabled={isMutationPending}
          onClose={() => {
            setSaveError(null)
            onCloseTask()
          }}
          onSave={saveTask}
        />
      )}
      {taskId !== undefined && (
        <TaskRoute
          taskDetails={taskDetails}
          error={saveError}
          disabled={isMutationPending}
          onClose={() => {
            setSaveError(null)
            onCloseTask()
          }}
          onSave={saveTask}
        />
      )}
    </main>
  )
}

function shouldShowBoardError(
  saveError: string | null,
  hasOpenTask: boolean,
): boolean {
  return saveError !== null && !hasOpenTask
}

function TaskRoute({
  taskDetails,
  error,
  disabled,
  onClose,
  onSave,
}: {
  taskDetails: TaskDetailsState
  error: string | null
  disabled: boolean
  onClose(): void
  onSave(task: TaskDraft): Promise<void>
}) {
  if (taskDetails.status === 'not-found')
    return <Navigate to="/board" replace />
  if (taskDetails.status === 'error') {
    return <p role="alert">Task details could not be loaded.</p>
  }
  if (taskDetails.status !== 'ready')
    return <p role="status">Loading task details.</p>

  return (
    <TaskDetailsDialog
      task={taskDetails.task}
      taskKey={taskDetails.task.key}
      mode="edit"
      error={error}
      disabled={disabled}
      onClose={onClose}
      onSave={onSave}
    />
  )
}
