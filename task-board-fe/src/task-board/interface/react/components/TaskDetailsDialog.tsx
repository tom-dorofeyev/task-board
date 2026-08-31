import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from 'react'
import {
  COLUMN_TITLES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../../../domain/task'
import {
  normalizeTaskDraft,
  validateTaskDraft,
  type TaskDraft,
} from '../../../domain/taskValidation'

interface TaskDetailsDialogProps {
  task: TaskDraft
  taskKey?: string
  mode?: 'create' | 'edit'
  error: string | null
  disabled?: boolean
  onClose(): void
  onSave(task: TaskDraft): Promise<void>
}

type TaskFormDraft = Omit<TaskDraft, 'labels'> & { labels: string }

export function TaskDetailsDialog({
  task,
  taskKey,
  mode = 'edit',
  error,
  disabled = false,
  onClose,
  onSave,
}: TaskDetailsDialogProps) {
  const [draft, setDraft] = useState<TaskFormDraft>(() => toDraft(task))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const titleId = useId()
  const titleInput = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogElement = dialog.current
    dialogElement?.showModal()
    titleInput.current?.focus()
    return () => {
      if (typeof dialogElement?.close === 'function') dialogElement.close()
    }
  }, [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === 'Escape' && !disabled && onClose()
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [disabled, onClose])

  const change = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setDraft((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const domainDraft = {
      ...draft,
      labels: draft.labels
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean),
    }
    const nextErrors = validateTaskDraft(domainDraft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0)
      await onSave(normalizeTaskDraft(domainDraft))
  }

  const closeBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (!disabled && event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="dialog-backdrop"
      onMouseDown={closeBackdrop}
      onCancel={(event) => {
        event.preventDefault()
        if (!disabled) onClose()
      }}
      aria-labelledby={titleId}
    >
      <section className="dialog">
        <header className="dialog__header">
          <div>
            <span className="eyebrow">{taskKey ?? 'NEW TASK'}</span>
            <h2 id={titleId}>
              {mode === 'create' ? 'Create task' : 'Task details'}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            disabled={disabled}
            aria-label="Close task details"
          >
            ×
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <FormField label="Title" error={errors.title}>
            <input
              ref={titleInput}
              name="title"
              value={draft.title}
              onChange={change}
              aria-invalid={Boolean(errors.title)}
            />
          </FormField>
          <FormField label="Description">
            <textarea
              name="description"
              rows={5}
              value={draft.description}
              onChange={change}
            />
          </FormField>
          <div className="form-grid">
            <FormField label="Status">
              <select name="status" value={draft.status} onChange={change}>
                {TASK_STATUSES.map((status) => (
                  <option value={status} key={status}>
                    {COLUMN_TITLES[status]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority">
              <select name="priority" value={draft.priority} onChange={change}>
                {TASK_PRIORITIES.map((priority) => (
                  <option value={priority} key={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Assignee" error={errors.assignee}>
            <input
              name="assignee"
              value={draft.assignee}
              onChange={change}
              aria-invalid={Boolean(errors.assignee)}
            />
          </FormField>
          <FormField label="Labels" hint="Separate labels with commas">
            <input name="labels" value={draft.labels} onChange={change} />
          </FormField>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="dialog__actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={onClose}
              disabled={disabled}
            >
              Cancel
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={disabled}
            >
              {mode === 'create' ? 'Create task' : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </dialog>
  )
}

function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {error && <small className="form-error">{error}</small>}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function toDraft(task: TaskDraft): TaskFormDraft {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    labels: task.labels.join(', '),
  }
}
