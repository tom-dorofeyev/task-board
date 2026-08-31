export const TASK_ID_GENERATOR = Symbol('TaskIdGenerator');

export interface TaskIdGenerator {
  next(): string;
}
