import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../../src/App'

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

test('board route displays a loading status while opening', () => {
  renderAppAt('/board')

  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
})

test('workspace root redirects to the board route', async () => {
  renderAppAt('/')

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Product roadmap' }),
  ).toBeInTheDocument()
  expectCurrentPath('/board')
})

test('task route opens the matching task', async () => {
  renderAppAt('/board/task-101')

  const dialog = await screen.findByRole('dialog', { name: 'Task details' })

  expect(within(dialog).getByText('NEX-101')).toBeInTheDocument()
  expectCurrentPath('/board/task-101')
})

test('task click navigates to its route', async () => {
  const user = renderAppAt('/board')

  await user.click(
    await screen.findByRole('button', { name: /^Open NEX-101:/ }),
  )

  expect(
    await screen.findByRole('dialog', { name: 'Task details' }),
  ).toBeInTheDocument()
  expectCurrentPath('/board/task-101')
})

test('unknown task route redirects to the board', async () => {
  renderAppAt('/board/missing-task')

  await waitFor(() => expectCurrentPath('/board'))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('successful task save returns to the board route', async () => {
  const user = renderAppAt('/board/task-101')
  const dialog = await screen.findByRole('dialog', { name: 'Task details' })

  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expectCurrentPath('/board'))
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
})

test('failed task request remains on the task route', async () => {
  const user = renderAppAt('/board/task-101')
  const dialog = await screen.findByRole('dialog', { name: 'Task details' })
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Request unavailable'))

  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Your changes could not be saved',
  )
  expectCurrentPath('/board/task-101')
})

test('task cancel returns to the board route', async () => {
  const user = renderAppAt('/board/task-101')
  const dialog = await screen.findByRole('dialog', { name: 'Task details' })

  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expectCurrentPath('/board'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('create action navigates to the static new-task route', async () => {
  const user = renderAppAt('/board')

  await user.click(await screen.findByRole('button', { name: 'Create task' }))

  expect(
    await screen.findByRole('dialog', { name: 'Create task' }),
  ).toBeInTheDocument()
  expectCurrentPath('/board/new-task')
})

test('static new-task route opens a blank create dialog', async () => {
  renderAppAt('/board/new-task')

  const dialog = await screen.findByRole('dialog', { name: 'Create task' })

  expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveValue('')
  expectCurrentPath('/board/new-task')
})

test('successful task creation merges the authoritative task', async () => {
  const user = renderAppAt('/board/new-task')
  const dialog = await screen.findByRole('dialog', { name: 'Create task' })
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Title' }),
    'New task',
  )
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Assignee' }),
    'Sam Lee',
  )

  await user.click(within(dialog).getByRole('button', { name: 'Create task' }))

  await waitFor(() => expectCurrentPath('/board'))
  expect(
    await screen.findByRole('heading', { name: 'New task' }),
  ).toBeInTheDocument()
})

test('create cancel returns to the board route', async () => {
  const user = renderAppAt('/board/new-task')
  const dialog = await screen.findByRole('dialog', { name: 'Create task' })

  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expectCurrentPath('/board'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('new-task route ignores unavailable local storage data', async () => {
  localStorage.setItem('nexus-task-board:v1', '{broken')
  renderAppAt('/board/new-task')

  expect(
    await screen.findByRole('dialog', { name: 'Create task' }),
  ).toBeInTheDocument()
  expectCurrentPath('/board/new-task')
})

function renderAppAt(path: string) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  )
  return user
}

function expectCurrentPath(path: string) {
  expect(screen.getByTestId('current-path')).toHaveTextContent(path)
}

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>
}
