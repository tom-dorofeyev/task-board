import { useCallback, useState } from 'react'
import { useLocation, useMatch, useNavigate, useParams } from 'react-router-dom'
import { LoadingIcon } from '../../../shared/interface/react/components/LoadingIcon'
import {
  mergeCreatedTask,
  removeTask,
  mergeUpdatedTask,
} from '../../application/taskBoardSnapshot'
import type { TaskBoardSnapshot } from '../../application/ports/TaskQueries'
import type { Task } from '../../domain/task'
import { createEmptyTaskDraft } from '../../domain/taskValidation'
import { useTaskBoardServices } from './TaskBoardContext'
import { TaskBoardView } from './components/TaskBoardView'
import {
  clearCreateTaskIntent,
  getOrCreateCreateTaskIntent,
} from './createTaskIntent'
import { useTaskBoardState, useTaskDetails } from './useTaskBoardState'
import { TaskBoardPagingContext } from './TaskBoardPagingContext'

export function TaskBoardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { taskId } = useParams<{ taskId: string }>()
  const isCreateRoute = useMatch('/board/new-task') !== null
  const {
    loadTaskBoard,
    taskQueries,
    getTask,
    createTask: createTaskUseCase,
    updateTask,
    deleteTask,
    moveTask,
  } = useTaskBoardServices()
  const [createIdempotencyKey] = useState(() =>
    isCreateRoute ? getOrCreateCreateTaskIntent() : '',
  )
  const { loadState, transitionTaskBoard, pageController } = useTaskBoardState(
    loadTaskBoard,
    taskQueries,
  )
  const taskDetails = useTaskDetails({
    taskId,
    requestKey: `${location.key}:${taskId ?? ''}`,
    boardReady: loadState.status === 'ready',
    getTask,
  })

  const openTask = useCallback(
    (taskId: string) => navigate(`/board/${encodeURIComponent(taskId)}`),
    [navigate],
  )
  const createTask = useCallback(() => {
    clearCreateTaskIntent()
    navigate('/board/new-task')
  }, [navigate])
  const closeTask = useCallback(() => {
    if (isCreateRoute) clearCreateTaskIntent()
    navigate('/board')
  }, [isCreateRoute, navigate])
  const replaceTaskBoard = useCallback(
    (taskBoard: TaskBoardSnapshot) => {
      transitionTaskBoard(() => taskBoard)
    },
    [transitionTaskBoard],
  )
  const mergeCreated = useCallback(
    (task: Task) => {
      transitionTaskBoard((taskBoard) => mergeCreatedTask(taskBoard, task))
    },
    [transitionTaskBoard],
  )
  const mergeUpdated = useCallback(
    (previous: Task, updated: Task) => {
      transitionTaskBoard((taskBoard) =>
        mergeUpdatedTask(taskBoard, previous, updated),
      )
    },
    [transitionTaskBoard],
  )
  const removeDeletedTask = useCallback(
    (task: Task) => {
      transitionTaskBoard((taskBoard) => removeTask(taskBoard, task))
    },
    [transitionTaskBoard],
  )

  if (loadState.status === 'loading') {
    return (
      <main className="board-state">
        <LoadingIcon />
      </main>
    )
  }
  if (loadState.status === 'error') {
    return (
      <main className="board-state" role="alert">
        <h1>Board unavailable</h1>
        <p>{loadState.message}</p>
      </main>
    )
  }

  return (
    <TaskBoardPagingContext value={pageController}>
      <TaskBoardView
        taskBoard={loadState.taskBoard}
        pageWindows={loadState.pageWindows}
        taskId={taskId}
        isCreateRoute={isCreateRoute}
        createIdempotencyKey={createIdempotencyKey}
        newTaskDraft={isCreateRoute ? createEmptyTaskDraft() : null}
        taskDetails={taskDetails}
        onTaskBoardChange={replaceTaskBoard}
        onTaskCreated={mergeCreated}
        onTaskUpdated={mergeUpdated}
        onTaskDeleted={removeDeletedTask}
        onOpenTask={openTask}
        onCreateTask={createTask}
        onCloseTask={closeTask}
        createTaskUseCase={createTaskUseCase}
        updateTask={updateTask}
        deleteTaskUseCase={deleteTask}
        moveTaskUseCase={moveTask}
      />
    </TaskBoardPagingContext>
  )
}
