export const TASK_PERMISSIONS = ['tasks:read', 'tasks:write'] as const;

export type Permission = (typeof TASK_PERMISSIONS)[number];
