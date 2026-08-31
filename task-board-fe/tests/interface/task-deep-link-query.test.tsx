import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import type { TaskBoardBootstrap } from '../../src/task-board/application/ports/TaskBoardBootstrap'
import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskCommands,
  UpdateTaskInput,
} from '../../src/task-board/application/ports/TaskCommands'
import type {
  TaskListRequest,
  TaskPage,
  TaskQueries,
} from '../../src/task-board/application/ports/TaskQueries'
import { CreateTask } from '../../src/task-board/application/use-cases/CreateTask'
import { GetTask } from '../../src/task-board/application/use-cases/GetTask'
import { LoadTaskBoard } from '../../src/task-board/application/use-cases/LoadTaskBoard'
import { MoveTask } from '../../src/task-board/application/use-cases/MoveTask'
import { UpdateTask } from '../../src/task-board/application/use-cases/UpdateTask'
import {
  moveTask as moveTaskToPosition,
  moveTaskBefore,
  tasksByStatus,
  type Task,
} from '../../src/task-board/domain/task'
import {
  TaskBoardContext,
  type TaskBoardServices,
} from '../../src/task-board/interface/react/TaskBoardContext'
import { TaskBoardPage } from '../../src/task-board/interface/react/TaskBoardPage'
import { useTaskDetails } from '../../src/task-board/interface/react/useTaskBoardState'

const UNLOADED_TASK: Task = {
  id: 'unloaded-task',
  key: 'NEX-900',
  title: 'Authoritatively loaded task',
  description: '',
  status: 'todo',
  priority: 'high',
  assignee: 'Sam Lee',
  labels: [],
  position: 4,
}

test('unloaded deep link resolves through the authoritative task query', async () => {
  renderPage('/board/unloaded-task', UNLOADED_TASK)

  const dialog = await screen.findByRole('dialog', { name: 'Task details' })

  expect(within(dialog).getByText('NEX-900')).toBeInTheDocument()
  expect(screen.getByLabelText('5 tasks')).toBeInTheDocument()
})

test('authoritative not-found redirects the deep link', async () => {
  renderPage('/board/missing-task', null)

  await waitFor(() =>
    expect(screen.getByTestId('current-path')).toHaveTextContent('/board'),
  )
})

test('task query failure retains the deep link and reports the error', async () => {
  renderPage('/board/unavailable-task', 'error')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Task details could not be loaded.',
  )
  expect(screen.getByTestId('current-path')).toHaveTextContent(
    '/board/unavailable-task',
  )
})

test('rapid A to B to A navigation ignores the first A response', async () => {
  const queries = new DeferredTaskQueries()
  const getTask = new GetTask(queries)
  const { rerender } = render(
    <DetailState taskId="a" requestKey="a-1" getTask={getTask} />,
  )
  await waitFor(() => expect(queries.requests).toHaveLength(1))

  rerender(<DetailState taskId="b" requestKey="b-1" getTask={getTask} />)
  await waitFor(() => expect(queries.requests).toHaveLength(2))
  rerender(<DetailState taskId="a" requestKey="a-2" getTask={getTask} />)
  await waitFor(() => expect(queries.requests).toHaveLength(3))

  await act(async () => {
    queries.requests[0].resolve({ ...UNLOADED_TASK, title: 'Stale A' })
  })
  expect(screen.getByRole('status')).toHaveTextContent('loading')

  await act(async () => {
    queries.requests[2].resolve({ ...UNLOADED_TASK, title: 'Current A' })
  })
  expect(screen.getByRole('status')).toHaveTextContent('Current A')
})

test('create retries reuse an intent key and a new draft gets a new key', async () => {
  const user = userEvent.setup()
  const adapter = new RetryingCreateAdapter()
  render(
    <TaskBoardTestHarness services={createServices(adapter)}>
      <MemoryRouter initialEntries={['/board/new-task']}>
        <Routes>
          <Route
            path="/board/new-task"
            element={<TaskBoardPage key="new-task" />}
          />
          <Route
            path="/board/:taskId?"
            element={<TaskBoardPage key="board-task" />}
          />
        </Routes>
      </MemoryRouter>
    </TaskBoardTestHarness>,
  )
  const firstDialog = await screen.findByRole('dialog', { name: 'Create task' })
  await fillRequiredDraft(user, firstDialog, 'First intent')

  await user.click(
    within(firstDialog).getByRole('button', { name: 'Create task' }),
  )
  expect(await within(firstDialog).findByRole('alert')).toBeInTheDocument()
  await user.click(
    within(firstDialog).getByRole('button', { name: 'Create task' }),
  )
  await screen.findByRole('heading', { name: 'First intent' })

  await user.click(await screen.findByRole('button', { name: 'Create task' }))
  const secondDialog = await screen.findByRole('dialog', {
    name: 'Create task',
  })
  await fillRequiredDraft(user, secondDialog, 'Second intent')
  await user.click(
    within(secondDialog).getByRole('button', { name: 'Create task' }),
  )

  expect(adapter.inputs).toHaveLength(3)
  expect(adapter.inputs[0].idempotencyKey).toBe(
    adapter.inputs[1].idempotencyKey,
  )
  expect(adapter.inputs[2].idempotencyKey).not.toBe(
    adapter.inputs[1].idempotencyKey,
  )
})

test('page renders the transitioned snapshot after a loaded task move', async () => {
  const user = userEvent.setup()
  const adapter = new RetryingCreateAdapter([UNLOADED_TASK])
  render(
    <TaskBoardTestHarness services={createServices(adapter)}>
      <MemoryRouter initialEntries={['/board']}>
        <Routes>
          <Route path="/board/:taskId?" element={<TaskBoardPage />} />
        </Routes>
      </MemoryRouter>
    </TaskBoardTestHarness>,
  )
  const moveButton = await screen.findByRole('button', {
    name: 'Move NEX-900',
  })

  moveButton.focus()
  await user.keyboard('{ArrowRight}')

  expect(
    within(screen.getByRole('region', { name: 'In progress' })).getByText(
      'NEX-900',
    ),
  ).toBeInTheDocument()
})

function renderPage(path: string, foundTask: Task | null | 'error') {
  const adapter = new PartialBoardAdapter(foundTask)
  const services = createServices(adapter)
  render(
    <TaskBoardTestHarness services={services}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/board" element={<TaskBoardPage />} />
          <Route path="/board/:taskId" element={<TaskBoardPage />} />
        </Routes>
        <CurrentPath />
      </MemoryRouter>
    </TaskBoardTestHarness>,
  )
}

function TaskBoardTestHarness({
  services,
  children,
}: {
  services: TaskBoardServices
  children: ReactNode
}) {
  return <TaskBoardContext value={services}>{children}</TaskBoardContext>
}

function createServices(
  adapter: TaskBoardBootstrap & TaskCommands & TaskQueries,
): TaskBoardServices {
  return {
    loadTaskBoard: new LoadTaskBoard(adapter, adapter, () => []),
    taskQueries: adapter,
    getTask: new GetTask(adapter),
    createTask: new CreateTask(adapter),
    updateTask: new UpdateTask(adapter),
    moveTask: new MoveTask(adapter),
  }
}

class PartialBoardAdapter
  implements TaskBoardBootstrap, TaskCommands, TaskQueries
{
  private readonly foundTask: Task | null | 'error'

  constructor(foundTask: Task | null | 'error') {
    this.foundTask = foundTask
  }

  async hasStoredBoard() {
    return true
  }

  async initialize() {}

  async listTasks(request: TaskListRequest): Promise<TaskPage> {
    return request.status === 'todo'
      ? { items: [], totalCount: 5, pageInfo: { nextToken: 'todo-next' } }
      : { items: [], totalCount: 0, pageInfo: {} }
  }

  async getTask() {
    if (this.foundTask === 'error') throw new Error('Task query unavailable')
    return this.foundTask
  }

  async createTask() {
    return UNLOADED_TASK
  }

  async updateTask(input: UpdateTaskInput) {
    return { ...UNLOADED_TASK, ...input.task }
  }

  async moveTask() {
    return {
      task: UNLOADED_TASK,
      previousStatus: UNLOADED_TASK.status,
      affectedTasks: [UNLOADED_TASK],
    }
  }

  async save() {
    await vi.fn()()
  }
}

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>
}

function DetailState({
  taskId,
  requestKey,
  getTask,
}: {
  taskId: string
  requestKey: string
  getTask: GetTask
}) {
  const details = useTaskDetails({
    taskId,
    requestKey,
    boardReady: true,
    getTask,
  })
  return (
    <output role="status">
      {details.status === 'ready' ? details.task.title : details.status}
    </output>
  )
}

class DeferredTaskQueries implements TaskQueries {
  readonly requests: Array<{
    id: string
    resolve(task: Task | null): void
  }> = []

  async listTasks(): Promise<TaskPage> {
    return { items: [], totalCount: 0, pageInfo: {} }
  }

  getTask(id: string): Promise<Task | null> {
    return new Promise((resolve) => {
      this.requests.push({ id, resolve })
    })
  }
}

class RetryingCreateAdapter
  implements TaskBoardBootstrap, TaskCommands, TaskQueries
{
  readonly inputs: CreateTaskInput[] = []
  private tasks: Task[]

  constructor(tasks: Task[] = []) {
    this.tasks = [...tasks]
  }

  async hasStoredBoard() {
    return true
  }

  async initialize() {}

  async listTasks(request: TaskListRequest): Promise<TaskPage> {
    const items = this.tasks.filter((task) => task.status === request.status)
    return { items, totalCount: items.length, pageInfo: {} }
  }

  async getTask(id: string) {
    return this.tasks.find((task) => task.id === id) ?? null
  }

  async createTask(input: CreateTaskInput) {
    this.inputs.push(input)
    if (this.inputs.length === 1) throw new Error('Storage unavailable')
    const task: Task = {
      ...input.task,
      id: `task-${this.inputs.length}`,
      key: `NEX-${this.inputs.length}`,
      position: this.tasks.length,
    }
    this.tasks.push(task)
    return task
  }

  async updateTask(input: UpdateTaskInput) {
    const task = this.tasks.find((candidate) => candidate.id === input.id)
    if (task === undefined) throw new Error('Task unavailable')
    return { ...task, ...input.task }
  }

  async moveTask(input: MoveTaskInput) {
    const previous = this.tasks.find((task) => task.id === input.taskId)
    if (previous === undefined) throw new Error('Task unavailable')
    this.tasks = input.beforeTaskId
      ? moveTaskBefore(this.tasks, input.taskId, input.beforeTaskId)
      : moveTaskToPosition(
          this.tasks,
          input.taskId,
          input.targetStatus,
          tasksByStatus(this.tasks, input.targetStatus).length,
        )
    const task = this.tasks.find((candidate) => candidate.id === input.taskId)
    if (task === undefined) throw new Error('Task unavailable')
    return {
      task,
      previousStatus: previous.status,
      affectedTasks: this.tasks.filter(
        (candidate) =>
          candidate.status === previous.status ||
          candidate.status === task.status,
      ),
    }
  }

  async save(tasks: readonly Task[]) {
    this.tasks = [...tasks]
  }
}

async function fillRequiredDraft(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  title: string,
) {
  await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), title)
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Assignee' }),
    'Sam Lee',
  )
}
