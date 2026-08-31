import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import {
  BOARD_ORDER_QUERY,
  createTaskPageWindow,
} from '../../src/task-board/application/taskPageWindow'
import { TaskStatusColumn } from '../../src/task-board/interface/react/components/TaskStatusColumn'

const callbacks = {
  onOpenTask: vi.fn(),
  onMoveTask: vi.fn(),
  onMoveTaskBefore: vi.fn(),
}

test('partial column displays its authoritative total', () => {
  render(
    <TaskStatusColumn
      status="todo"
      tasks={[]}
      pageWindow={partialTodoWindow()}
      canMoveTasks={false}
      canDropAtEnd={false}
      hasUnloadedBoundary
      {...callbacks}
    />,
  )

  expect(screen.getByLabelText('3 tasks')).toHaveTextContent('3')
})

test('partial column is not empty when unloaded tasks exist', () => {
  render(
    <TaskStatusColumn
      status="todo"
      tasks={[]}
      pageWindow={partialTodoWindow()}
      canMoveTasks={false}
      canDropAtEnd={false}
      hasUnloadedBoundary
      {...callbacks}
    />,
  )

  expect(screen.queryByText('No tasks here yet.')).not.toBeInTheDocument()
})

const partialTodoWindow = () =>
  createTaskPageWindow(BOARD_ORDER_QUERY('todo'), {
    items: [],
    totalCount: 3,
    pageInfo: {},
  })
