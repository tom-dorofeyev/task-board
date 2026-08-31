import { useCallback, useEffect, useRef, useState } from 'react'
import type { TaskBoardSnapshot } from '../../application/ports/TaskQueries'
import { TaskBoardPageController } from '../../application/TaskBoardPageController'
import type { TaskQueries } from '../../application/ports/TaskQueries'
import type { GetTask } from '../../application/use-cases/GetTask'
import type { LoadTaskBoard } from '../../application/use-cases/LoadTaskBoard'
import type { TaskDetailsState } from './components/TaskBoardView'
import {
  TaskBoardInitialLoad,
  type TaskBoardLoadState,
} from './TaskBoardInitialLoad'

export type { TaskBoardLoadState } from './TaskBoardInitialLoad'

export function useTaskBoardState(
  loadTaskBoard: LoadTaskBoard,
  taskQueries: TaskQueries,
) {
  const [loadState, setLoadState] = useState<TaskBoardLoadState>({
    status: 'loading',
  })
  const [pageController] = useState(
    () => new TaskBoardPageController(taskQueries),
  )
  const [initialLoad] = useState(
    () =>
      new TaskBoardInitialLoad({
        loadTaskBoard,
        pageController,
        publishLoadState: setLoadState,
      }),
  )

  useEffect(() => {
    const unsubscribe = pageController.subscribe(initialLoad.publishPageWindows)
    initialLoad.start()
    return () => {
      initialLoad.stop()
      unsubscribe()
    }
  }, [initialLoad, pageController])

  const transitionTaskBoard = useCallback(
    (transition: (taskBoard: TaskBoardSnapshot) => TaskBoardSnapshot) => {
      pageController.transition(transition)
    },
    [pageController],
  )

  return { loadState, transitionTaskBoard, pageController }
}

export function useTaskDetails(options: {
  taskId: string | undefined
  requestKey: string
  boardReady: boolean
  getTask: GetTask
}): TaskDetailsState {
  const { taskId, requestKey, boardReady, getTask } = options
  const generation = useRef(0)
  const [result, setResult] = useState<{
    requestKey: string
    details: TaskDetailsState
  }>({ requestKey: '', details: { status: 'idle' } })

  useEffect(() => {
    const requestGeneration = ++generation.current
    if (taskId === undefined || !boardReady) return
    getTask.execute(taskId).then(
      (task) => {
        if (requestGeneration !== generation.current) return
        setResult({
          requestKey,
          details:
            task === null ? { status: 'not-found' } : { status: 'ready', task },
        })
      },
      () => {
        if (requestGeneration === generation.current) {
          setResult({ requestKey, details: { status: 'error' } })
        }
      },
    )
    return () => {
      if (requestGeneration === generation.current) generation.current += 1
    }
  }, [boardReady, getTask, requestKey, taskId])

  if (taskId === undefined) return { status: 'idle' }
  return result.requestKey === requestKey
    ? result.details
    : { status: 'loading' }
}
