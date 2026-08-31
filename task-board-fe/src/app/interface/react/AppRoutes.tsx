import { AuthenticatedRoute } from '../../../authentication/interface/react/AuthenticatedRoute'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginRoute } from '../../../authentication/interface/react/LoginRoute'
import { NotFoundPage } from '../../../shared/interface/react/NotFoundPage'
import { TaskBoardPage } from '../../../task-board/interface/react/TaskBoardPage'
import { TaskBoardRoute } from '../../../task-board/interface/react/TaskBoardRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/board" replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<AuthenticatedRoute />}>
        <Route element={<TaskBoardRoute />}>
          <Route
            path="/board/new-task"
            element={<TaskBoardPage key="new-task" />}
          />
          <Route
            path="/board/:taskId?"
            element={<TaskBoardPage key="board-task" />}
          />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
