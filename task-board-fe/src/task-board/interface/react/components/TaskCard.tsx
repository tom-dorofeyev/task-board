import {
  TASK_STATUSES,
  type Task,
  type TaskId,
  type TaskStatus,
} from '../../../domain/task'

interface TaskCardProps {
  task: Task
  position: number
  canMove: boolean
  hasUnloadedBoundary: boolean
  onOpen(taskId: TaskId): void
  onDelete(taskId: TaskId): void
  onMove(status: TaskStatus, position: number): void
  onDropTask(taskId: string): void
}

export function TaskCard({
  task,
  position,
  canMove,
  hasUnloadedBoundary,
  onOpen,
  onDelete,
  onMove,
  onDropTask,
}: TaskCardProps) {
  const initials = task.assignee
    .split(' ')
    .map((part) => part[0])
    .join('')

  return (
    <article
      className="task-card"
      aria-label={`${task.key}: ${task.title}`}
      draggable={canMove}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/task-id', task.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(event) => canMove && event.preventDefault()}
      onDrop={(event) => {
        event.stopPropagation()
        if (!canMove) return
        onDropTask(event.dataTransfer.getData('text/task-id'))
      }}
    >
      <button
        className="task-card__open"
        type="button"
        onClick={() => onOpen(task.id)}
        aria-label={`Open ${task.key}: ${task.title}`}
      />
      <button
        className="task-card__delete"
        type="button"
        onClick={() => onDelete(task.id)}
        aria-label={`Delete ${task.key}`}
        title="Delete task"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-8 0 1 13h8l1-13" />
        </svg>
      </button>
      <button
        className="drag-handle"
        type="button"
        draggable={canMove}
        disabled={!canMove}
        aria-describedby={
          hasUnloadedBoundary
            ? 'move-instructions board-boundary-instructions'
            : 'move-instructions'
        }
        title={
          hasUnloadedBoundary
            ? 'Moves beyond loaded tasks are unavailable'
            : undefined
        }
        aria-label={`Move ${task.key}`}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/task-id', task.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onKeyDown={(event) => {
          const index = TASK_STATUSES.indexOf(task.status)
          if (event.key === 'ArrowRight' && index < TASK_STATUSES.length - 1) {
            event.preventDefault()
            onMove(TASK_STATUSES[index + 1], position)
          }
          if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault()
            onMove(TASK_STATUSES[index - 1], position)
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            onMove(task.status, position + 1)
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onMove(task.status, position - 1)
          }
        }}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <div className="task-card__meta">
        <span className={`priority priority--${task.priority}`}>
          {task.priority}
        </span>
        <span className="task-card__key">{task.key}</span>
      </div>
      <h3>{task.title}</h3>
      <div className="task-card__labels">
        {task.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <footer>
        <span className="avatar" title={task.assignee}>
          {initials}
        </span>
        <span>{task.assignee}</span>
      </footer>
    </article>
  )
}
