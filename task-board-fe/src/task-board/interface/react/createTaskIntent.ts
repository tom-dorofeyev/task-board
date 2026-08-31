const CREATE_TASK_INTENT_STORAGE_KEY = 'nexus-task-board:create-intent:v1'

export function getOrCreateCreateTaskIntent(
  storage: Storage = window.sessionStorage,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = storage.getItem(CREATE_TASK_INTENT_STORAGE_KEY)
  if (existing !== null && existing.trim().length > 0) return existing
  const created = createId()
  storage.setItem(CREATE_TASK_INTENT_STORAGE_KEY, created)
  return created
}

export function clearCreateTaskIntent(
  storage: Storage = window.sessionStorage,
): void {
  storage.removeItem(CREATE_TASK_INTENT_STORAGE_KEY)
}
