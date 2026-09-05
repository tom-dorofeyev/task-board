import { useEffect, useId, useRef } from 'react'
import type { Task } from '../../../domain/task'

interface DeleteTaskDialogProps {
  task: Task
  disabled: boolean
  error: string | null
  onCancel(): void
  onConfirm(): void
}

export function DeleteTaskDialog({
  task,
  disabled,
  error,
  onCancel,
  onConfirm,
}: DeleteTaskDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialogElement = dialog.current
    dialogElement?.showModal()
    return () => {
      if (typeof dialogElement?.close === 'function') dialogElement.close()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="dialog-backdrop"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!disabled) onCancel()
      }}
    >
      <section className="dialog dialog--confirmation">
        <h2 id={titleId}>Delete task?</h2>
        <p>
          Delete{' '}
          <strong>
            {task.key}: {task.title}
          </strong>
          ? This cannot be undone.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </button>
          <button
            className="button button--danger"
            type="button"
            onClick={onConfirm}
            disabled={disabled}
          >
            Delete task
          </button>
        </footer>
      </section>
    </dialog>
  )
}
