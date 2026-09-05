import { createContext, useContext } from 'react'
import type { CreateTask } from '../../application/use-cases/CreateTask'
import type { DeleteTask } from '../../application/use-cases/DeleteTask'
import type { GetTask } from '../../application/use-cases/GetTask'
import type { LoadTaskBoard } from '../../application/use-cases/LoadTaskBoard'
import type { MoveTask } from '../../application/use-cases/MoveTask'
import type { UpdateTask } from '../../application/use-cases/UpdateTask'
import type { TaskQueries } from '../../application/ports/TaskQueries'

export interface TaskBoardServices {
  loadTaskBoard: LoadTaskBoard
  taskQueries: TaskQueries
  getTask: GetTask
  createTask: CreateTask
  updateTask: UpdateTask
  deleteTask: DeleteTask
  moveTask: MoveTask
}

export const TaskBoardContext = createContext<TaskBoardServices | null>(null)

export function useTaskBoardServices(): TaskBoardServices {
  const services = useContext(TaskBoardContext)

  if (services === null) {
    throw new Error(
      'useTaskBoardServices must be used within a TaskBoardProvider',
    )
  }

  return services
}
