import { createContext, useContext } from 'react'
import type { TaskBoardPageController } from '../../application/TaskBoardPageController'

export const TaskBoardPagingContext =
  createContext<TaskBoardPageController | null>(null)

export function useTaskBoardPaging(): TaskBoardPageController {
  const controller = useContext(TaskBoardPagingContext)
  if (controller === null) {
    throw new Error(
      'useTaskBoardPaging must be used within a TaskBoardPagingContext',
    )
  }
  return controller
}
