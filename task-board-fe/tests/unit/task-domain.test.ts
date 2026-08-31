import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  moveTask,
  tasksByStatus,
  type Task,
} from '../../src/task-board/domain/task'

const EARLIER_TASK = createTask('earlier', 'todo', 0)
const LATER_TASK = createTask('later', 'todo', 1)
const DONE_TASK = createTask('done', 'done', 0)

describe('tasksByStatus', () => {
  it('returns only requested status in position order', () => {
    const result = tasksByStatus([LATER_TASK, DONE_TASK, EARLIER_TASK], 'todo')

    assert.deepEqual(
      result.map((task) => task.id),
      ['earlier', 'later'],
    )
  })

  it('does not mutate the input collection', () => {
    const input = [LATER_TASK, EARLIER_TASK]

    tasksByStatus(input, 'todo')

    assert.deepEqual(
      input.map((task) => task.id),
      ['later', 'earlier'],
    )
  })
})

describe('moveTask', () => {
  it('moves a task across columns and normalizes positions', () => {
    const moved = moveTask(
      [EARLIER_TASK, LATER_TASK, DONE_TASK],
      'earlier',
      'done',
      0,
    )

    assert.deepEqual(
      moved.map(({ id, status, position }) => ({ id, status, position })),
      [
        { id: 'later', status: 'todo', position: 0 },
        { id: 'earlier', status: 'done', position: 0 },
        { id: 'done', status: 'done', position: 1 },
      ],
    )
  })

  it('returns the original board for an unknown task', () => {
    const tasks = [EARLIER_TASK]

    assert.equal(moveTask(tasks, 'missing', 'done', 0), tasks)
  })
})

function createTask(
  id: string,
  status: Task['status'],
  position: number,
): Task {
  return {
    id,
    key: id,
    title: id,
    description: '',
    status,
    priority: 'low',
    assignee: '',
    labels: [],
    position,
  }
}
