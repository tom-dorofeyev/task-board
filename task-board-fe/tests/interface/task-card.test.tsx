import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { type Task } from '../../src/task-board/domain/task'
import { TaskCard } from '../../src/task-board/interface/react/components/TaskCard'

const task: Task = {
  id: 'task-102',
  key: 'NEX-102',
  title: 'Draft empty states',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'Ada Lovelace',
  labels: [],
  position: 0,
}

test('task card transfers its id when dragged', () => {
  const dataTransfer = createDataTransfer()
  renderTaskCard()

  fireEvent.dragStart(screen.getByRole('article'), { dataTransfer })

  expect(dataTransfer).toMatchObject({
    effectAllowed: 'move',
    taskId: task.id,
  })
})

test('task card actions provide only the task ID', () => {
  const onOpen = vi.fn()
  const onDelete = vi.fn()
  renderTaskCard({ onOpen, onDelete })

  fireEvent.click(screen.getByRole('button', { name: /open nex-102/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete NEX-102' }))

  expect(onOpen).toHaveBeenCalledWith(task.id)
  expect(onDelete).toHaveBeenCalledWith(task.id)
})

function renderTaskCard({
  onOpen = vi.fn(),
  onDelete = vi.fn(),
}: {
  onOpen?: ReturnType<typeof vi.fn>
  onDelete?: ReturnType<typeof vi.fn>
} = {}) {
  render(
    <TaskCard
      task={task}
      position={0}
      canMove
      hasUnloadedBoundary={false}
      onOpen={onOpen}
      onDelete={onDelete}
      onMove={vi.fn()}
      onDropTask={vi.fn()}
    />,
  )
}

function createDataTransfer() {
  return {
    effectAllowed: '',
    setData(type: string, value: string) {
      if (type === 'text/task-id') this.taskId = value
    },
    taskId: '',
  }
}
