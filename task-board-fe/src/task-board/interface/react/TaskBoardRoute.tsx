import { Outlet } from 'react-router-dom'
import { TaskBoardProvider } from './TaskBoardProvider'

export function TaskBoardRoute() {
  return (
    <TaskBoardProvider>
      <Outlet />
    </TaskBoardProvider>
  )
}
