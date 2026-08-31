import { useState } from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import type { TaskBoardSnapshot } from '../../src/task-board/application/ports/TaskQueries'
import { createTaskBoardPageWindows } from '../../src/task-board/application/taskPageWindow'
import { CreateTask } from '../../src/task-board/application/use-cases/CreateTask'
import { MoveTask } from '../../src/task-board/application/use-cases/MoveTask'
import { UpdateTask } from '../../src/task-board/application/use-cases/UpdateTask'
import type { Task } from '../../src/task-board/domain/task'
import { TaskBoardView } from '../../src/task-board/interface/react/components/TaskBoardView'

const TASK: Task = {
  id: 'task-1',
  key: 'NEX-1',
  title: 'Loaded task',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'Sam Lee',
  labels: [],
  position: 0,
}

test('incomplete board exposes boundary guidance while keeping anchored moves available', () => {
  renderBoard(incompleteBoard(), TASK.id)

  expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Move NEX-1' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Move NEX-1' })).toHaveAttribute(
    'aria-describedby',
    'move-instructions board-boundary-instructions',
  )
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
})

test('incomplete board rejects a keyboard move across an unloaded boundary', () => {
  const { onTaskBoardChange, moveTask } = renderBoard(
    incompleteBoard(),
    TASK.id,
  )
  const moveButton = screen.getByRole('button', { name: 'Move NEX-1' })

  fireEvent.keyDown(moveButton, { key: 'ArrowDown' })

  expect(onTaskBoardChange).not.toHaveBeenCalled()
  expect(moveTask).not.toHaveBeenCalled()
  expect(screen.getByText(/Load more tasks before moving/)).toBeInTheDocument()
})

test('incomplete board rejects moving above an unloaded previous page', () => {
  const taskBoard: TaskBoardSnapshot = {
    ...incompleteBoard(),
    todo: {
      items: [TASK],
      totalCount: 2,
      pageInfo: { previousToken: 'todo-previous' },
    },
  }
  const { onTaskBoardChange, moveTask } = renderBoard(taskBoard, TASK.id)

  fireEvent.keyDown(screen.getByRole('button', { name: 'Move NEX-1' }), {
    key: 'ArrowUp',
  })

  expect(onTaskBoardChange).not.toHaveBeenCalled()
  expect(moveTask).not.toHaveBeenCalled()
  expect(screen.getByText(/Load more tasks before moving/)).toBeInTheDocument()
})

test('previous-only page allows moving to its known absolute end', async () => {
  const taskBoard: TaskBoardSnapshot = {
    ...incompleteBoard(),
    todo: {
      items: [TASK],
      totalCount: 2,
      pageInfo: { previousToken: 'todo-previous' },
    },
  }
  const move = vi.fn(async () => ({
    task: TASK,
    previousStatus: 'todo' as const,
    affectedTasks: [TASK],
  }))
  renderBoard(taskBoard, TASK.id, move)

  fireEvent.keyDown(screen.getByRole('button', { name: 'Move NEX-1' }), {
    key: 'ArrowDown',
  })

  await waitFor(() =>
    expect(move).toHaveBeenCalledWith({
      taskId: TASK.id,
      targetStatus: 'todo',
      beforeTaskId: null,
    }),
  )
})

test('tokenless incomplete page blocks both directional boundaries', () => {
  const taskBoard: TaskBoardSnapshot = {
    ...incompleteBoard(),
    todo: { items: [TASK], totalCount: 2, pageInfo: {} },
  }
  const { moveTask } = renderBoard(taskBoard, TASK.id)
  const handle = screen.getByRole('button', { name: 'Move NEX-1' })

  fireEvent.keyDown(handle, { key: 'ArrowUp' })
  fireEvent.keyDown(handle, { key: 'ArrowDown' })

  expect(moveTask).not.toHaveBeenCalled()
  expect(screen.getByText(/Load more tasks before moving/)).toBeInTheDocument()
})

test('incomplete board allows a keyboard move before a visible anchor', async () => {
  const later = { ...TASK, id: 'task-2', key: 'NEX-2', position: 1 }
  const taskBoard: TaskBoardSnapshot = {
    ...incompleteBoard(),
    todo: {
      items: [TASK, later],
      totalCount: 3,
      pageInfo: { nextToken: 'todo-next' },
    },
  }
  const move = vi.fn(async () => ({
    task: { ...later, position: 0 },
    previousStatus: 'todo' as const,
    affectedTasks: [
      { ...later, position: 0 },
      { ...TASK, position: 1 },
    ],
  }))
  renderBoard(taskBoard, later.id, move)

  fireEvent.keyDown(screen.getByRole('button', { name: 'Move NEX-2' }), {
    key: 'ArrowUp',
  })

  await waitFor(() =>
    expect(move).toHaveBeenCalledWith({
      taskId: later.id,
      targetStatus: 'todo',
      beforeTaskId: TASK.id,
    }),
  )
})

test('pointer preview inserts before a visible non-zero-position anchor', async () => {
  const anchor = { ...TASK, id: 'anchor', key: 'NEX-5', position: 5 }
  const moved = { ...TASK, id: 'moved', key: 'NEX-6', position: 6 }
  const taskBoard: TaskBoardSnapshot = {
    ...incompleteBoard(),
    todo: {
      items: [anchor, moved],
      totalCount: 3,
      pageInfo: { nextToken: 'todo-next' },
    },
  }
  const move = vi.fn(() => new Promise(() => undefined))
  render(<StatefulBoard initialTaskBoard={taskBoard} move={move} />)

  fireEvent.drop(screen.getByRole('article', { name: 'NEX-5: Loaded task' }), {
    dataTransfer: { getData: () => moved.id },
  })

  await waitFor(() => expect(move).toHaveBeenCalled())
  expect(screen.getByRole('button', { name: 'Move NEX-6' })).toBeDisabled()
  fireEvent.drop(screen.getByRole('article', { name: 'NEX-5: Loaded task' }), {
    dataTransfer: { getData: () => moved.id },
  })
  expect(move).toHaveBeenCalledTimes(1)
  expect(
    within(screen.getByRole('region', { name: 'To do' }))
      .getAllByRole('article')
      .map((article) => article.getAttribute('aria-label')),
  ).toEqual(['NEX-6: Loaded task', 'NEX-5: Loaded task'])
})

test('missing deep link remains open while tasks are not fully loaded', () => {
  renderBoard(incompleteBoard(), 'unloaded-task')

  expect(screen.getByText('Loading task details.')).toBeInTheDocument()
  expect(screen.getByTestId('current-path')).toHaveTextContent(
    '/board/unloaded-task',
  )
})

test('failed authoritative move restores items totals and tokens', async () => {
  const taskBoard: TaskBoardSnapshot = {
    ...incompleteBoard(),
    todo: { items: [TASK], totalCount: 1, pageInfo: {} },
  }
  const failure = vi.fn(async () => {
    throw new Error('Move unavailable')
  })
  const { onTaskBoardChange } = renderBoard(taskBoard, TASK.id, failure)

  fireEvent.keyDown(screen.getByRole('button', { name: 'Move NEX-1' }), {
    key: 'ArrowRight',
  })

  await waitFor(() => expect(onTaskBoardChange).toHaveBeenCalledTimes(2))
  expect(onTaskBoardChange).toHaveBeenLastCalledWith(taskBoard)
  expect(screen.getByRole('alert')).toHaveTextContent('board was restored')
})

function incompleteBoard(): TaskBoardSnapshot {
  const emptyPage = { items: [], totalCount: 0, pageInfo: {} }
  return {
    todo: {
      items: [TASK],
      totalCount: 2,
      pageInfo: { nextToken: 'todo-next' },
    },
    'in-progress': emptyPage,
    done: emptyPage,
  }
}

function renderBoard(
  taskBoard: TaskBoardSnapshot,
  taskId: string,
  moveTask = vi.fn(),
) {
  const onTaskBoardChange = vi.fn()
  const commands = {
    createTask: vi.fn(async () => TASK),
    updateTask: vi.fn(async () => TASK),
    moveTask,
  }
  render(
    <MemoryRouter initialEntries={[`/board/${taskId}`]}>
      <TaskBoardView
        taskBoard={taskBoard}
        pageWindows={createTaskBoardPageWindows(taskBoard)}
        taskId={taskId}
        isCreateRoute={false}
        createIdempotencyKey="create-intent"
        newTaskDraft={null}
        taskDetails={
          taskId === TASK.id
            ? { status: 'ready', task: TASK }
            : { status: 'loading' }
        }
        onTaskBoardChange={onTaskBoardChange}
        onTaskCreated={vi.fn()}
        onTaskUpdated={vi.fn()}
        onOpenTask={vi.fn()}
        onCreateTask={vi.fn()}
        onCloseTask={vi.fn()}
        createTaskUseCase={new CreateTask(commands)}
        updateTask={new UpdateTask(commands)}
        moveTaskUseCase={new MoveTask(commands)}
      />
      <CurrentPath />
    </MemoryRouter>,
  )
  return { onTaskBoardChange, moveTask }
}

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>
}

function StatefulBoard({
  initialTaskBoard,
  move,
}: {
  initialTaskBoard: TaskBoardSnapshot
  move: ReturnType<typeof vi.fn>
}) {
  const [taskBoard, setTaskBoard] = useState(initialTaskBoard)
  const commands = {
    createTask: vi.fn(async () => TASK),
    updateTask: vi.fn(async () => TASK),
    moveTask: move,
  }
  return (
    <MemoryRouter>
      <TaskBoardView
        taskBoard={taskBoard}
        pageWindows={createTaskBoardPageWindows(taskBoard)}
        taskId={undefined}
        isCreateRoute={false}
        createIdempotencyKey="create-intent"
        newTaskDraft={null}
        taskDetails={{ status: 'idle' }}
        onTaskBoardChange={setTaskBoard}
        onTaskCreated={vi.fn()}
        onTaskUpdated={vi.fn()}
        onOpenTask={vi.fn()}
        onCreateTask={vi.fn()}
        onCloseTask={vi.fn()}
        createTaskUseCase={new CreateTask(commands)}
        updateTask={new UpdateTask(commands)}
        moveTaskUseCase={new MoveTask(commands)}
      />
    </MemoryRouter>
  )
}
