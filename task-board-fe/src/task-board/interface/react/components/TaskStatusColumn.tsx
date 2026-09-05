import type { TaskPageWindow } from '../../../application/taskPageWindow'
import {
  COLUMN_TITLES,
  type Task,
  type TaskId,
  type TaskStatus,
} from '../../../domain/task'
import { TaskCard } from './TaskCard'

interface TaskStatusColumnProps {
  status: TaskStatus
  tasks: Task[]
  pageWindow: TaskPageWindow
  canMoveTasks: boolean
  canDropAtEnd: boolean
  hasUnloadedBoundary: boolean
  onOpenTask(taskId: TaskId): void
  onDeleteTask(taskId: TaskId): void
  onMoveTask(taskId: string, status: TaskStatus, position: number): void
  onMoveTaskBefore(taskId: string, targetTaskId: string): void
}

export function TaskStatusColumn({
  status,
  tasks,
  pageWindow,
  canMoveTasks,
  canDropAtEnd,
  hasUnloadedBoundary,
  onOpenTask,
  onDeleteTask,
  onMoveTask,
  onMoveTaskBefore,
}: TaskStatusColumnProps) {
  const columnTasks = tasks.filter((task) => task.status === status)
  const totalCount = pageWindow.page.totalCount

  return (
    <section
      className="column"
      aria-labelledby={`${status}-title`}
      onDragOver={(event) => canDropAtEnd && event.preventDefault()}
      onDrop={(event) => {
        if (!canDropAtEnd) return
        onMoveTask(
          event.dataTransfer.getData('text/task-id'),
          status,
          columnTasks.length,
        )
      }}
    >
      <header className="column__header">
        <div
          className={`status-dot status-dot--${status}`}
          aria-hidden="true"
        />
        <h2 id={`${status}-title`}>{COLUMN_TITLES[status]}</h2>
        <span className="column__count" aria-label={`${totalCount} tasks`}>
          {totalCount}
        </span>
      </header>
      <div className="column__tasks">
        {columnTasks.map((task, position) => (
          <TaskCard
            task={task}
            key={task.id}
            position={position}
            canMove={canMoveTasks}
            hasUnloadedBoundary={hasUnloadedBoundary}
            onOpen={onOpenTask}
            onDelete={onDeleteTask}
            onMove={(targetStatus, targetPosition) =>
              onMoveTask(task.id, targetStatus, targetPosition)
            }
            onDropTask={(taskId) => onMoveTaskBefore(taskId, task.id)}
          />
        ))}
        {totalCount === 0 && <p className="empty-column">No tasks here yet.</p>}
      </div>
    </section>
  )
}
