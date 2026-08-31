import { useMemo, type PropsWithChildren } from 'react'
import { CreateTask } from '../../application/use-cases/CreateTask'
import { GetTask } from '../../application/use-cases/GetTask'
import { LoadTaskBoard } from '../../application/use-cases/LoadTaskBoard'
import { MoveTask } from '../../application/use-cases/MoveTask'
import { UpdateTask } from '../../application/use-cases/UpdateTask'
import { useAuthenticatedRequests } from '../../../authentication/interface/react/AuthenticatedRequestsContext'
import type { CookieHttpService } from '../../../shared/infrastructure/http/CookieHttpRequestBoundary'
import { HttpTaskRepository } from '../../infrastructure/http/HttpTaskRepository'
import { TaskBoardContext, type TaskBoardServices } from './TaskBoardContext'

function createTaskBoardServices(
  requests: CookieHttpService,
): TaskBoardServices {
  const repository = new HttpTaskRepository(requests)

  return {
    loadTaskBoard: new LoadTaskBoard(repository, repository, () => []),
    taskQueries: repository,
    getTask: new GetTask(repository),
    createTask: new CreateTask(repository),
    updateTask: new UpdateTask(repository),
    moveTask: new MoveTask(repository),
  }
}

export function TaskBoardProvider({ children }: PropsWithChildren) {
  const requests = useAuthenticatedRequests()
  const services = useMemo(() => createTaskBoardServices(requests), [requests])

  return <TaskBoardContext value={services}>{children}</TaskBoardContext>
}
