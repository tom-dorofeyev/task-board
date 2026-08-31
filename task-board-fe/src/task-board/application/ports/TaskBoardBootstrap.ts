import type { Task } from '../../domain/task'

export interface TaskBoardBootstrap {
  hasStoredBoard(): Promise<boolean>
  initialize(tasks: readonly Task[]): Promise<void>
}
