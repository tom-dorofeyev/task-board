import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
  TaskBoardSnapshot,
  TaskPage,
} from '../../src/task-board/application/ports/TaskQueries'
import {
  isTaskBoardExhaustive,
  mergeCreatedTask,
  mergeUpdatedTask,
  reconcileMovedTask,
  transitionLoadedTasks,
} from '../../src/task-board/application/taskBoardSnapshot'
import type { Task } from '../../src/task-board/domain/task'

const TASK: Task = {
  id: 'task-1',
  key: 'NEX-1',
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'Sam Lee',
  labels: [],
  position: 0,
}

describe('task board snapshot', () => {
  it('invalidates continuation metadata for a changed page', () => {
    const snapshot = createSnapshot({
      items: [TASK],
      totalCount: 2,
      pageInfo: { nextToken: 'next-page' },
    })

    const result = transitionLoadedTasks(snapshot, [{ ...TASK, title: 'New' }])

    assert.deepEqual(result.todo, {
      items: [{ ...TASK, title: 'New' }],
      totalCount: 2,
      pageInfo: {},
    })
  })

  it('classifies item count gaps as incomplete', () => {
    const snapshot = createSnapshot({
      items: [TASK],
      totalCount: 2,
      pageInfo: {},
    })

    assert.equal(isTaskBoardExhaustive(snapshot), false)
  })

  it('classifies continuation metadata as incomplete', () => {
    const snapshot = createSnapshot({
      items: [TASK],
      totalCount: 1,
      pageInfo: { previousToken: 'previous-page' },
    })

    assert.equal(isTaskBoardExhaustive(snapshot), false)
  })

  it('increments a created task total only once', () => {
    const snapshot = createSnapshot({ items: [], totalCount: 3, pageInfo: {} })

    const firstMerge = mergeCreatedTask(snapshot, TASK)
    const retryMerge = mergeCreatedTask(firstMerge, TASK)

    assert.deepEqual(
      { totalCount: retryMerge.todo.totalCount, items: retryMerge.todo.items },
      { totalCount: 4, items: [TASK] },
    )
  })

  it('keeps an updated unloaded entity out of a partial list page', () => {
    const snapshot = createSnapshot({ items: [], totalCount: 3, pageInfo: {} })

    const result = mergeUpdatedTask(snapshot, TASK, {
      ...TASK,
      title: 'Updated',
    })

    assert.deepEqual(result.todo, snapshot.todo)
  })

  it('reconciles an updated entity into an exhaustive snapshot', () => {
    const snapshot = createSnapshot({ items: [], totalCount: 0, pageInfo: {} })
    const updated = { ...TASK, title: 'Updated' }

    const result = mergeUpdatedTask(snapshot, TASK, updated)

    assert.deepEqual(result.todo, {
      items: [updated],
      totalCount: 1,
      pageInfo: {},
    })
  })

  it('moves authoritative totals without loading an unseen updated entity', () => {
    const snapshot: TaskBoardSnapshot = {
      todo: { items: [], totalCount: 4, pageInfo: { nextToken: 'todo-next' } },
      'in-progress': { items: [], totalCount: 2, pageInfo: {} },
      done: { items: [], totalCount: 0, pageInfo: {} },
    }
    const updated = { ...TASK, status: 'in-progress' as const }

    const result = mergeUpdatedTask(snapshot, TASK, updated)

    assert.deepEqual(
      {
        todo: result.todo,
        inProgress: result['in-progress'],
      },
      {
        todo: { items: [], totalCount: 3, pageInfo: {} },
        inProgress: { items: [], totalCount: 3, pageInfo: {} },
      },
    )
  })

  it('uses the loaded status when it races the authoritative prior entity', () => {
    const staleLoadedTask = { ...TASK, status: 'done' as const }
    const snapshot: TaskBoardSnapshot = {
      todo: { items: [], totalCount: 4, pageInfo: { nextToken: 'todo-next' } },
      'in-progress': {
        items: [],
        totalCount: 0,
        pageInfo: { previousToken: 'progress-previous' },
      },
      done: {
        items: [staleLoadedTask],
        totalCount: 1,
        pageInfo: { nextToken: 'done-next' },
      },
    }
    const updated = { ...TASK, status: 'in-progress' as const }

    const result = mergeUpdatedTask(snapshot, TASK, updated)

    assert.deepEqual(result, {
      todo: snapshot.todo,
      'in-progress': { items: [updated], totalCount: 1, pageInfo: {} },
      done: { items: [], totalCount: 0, pageInfo: {} },
    })
    assert.equal(isTaskBoardExhaustive(result), false)
  })

  it('reconciles a cross-status move with exact totals and authoritative order', () => {
    const other = {
      ...TASK,
      id: 'other',
      key: 'NEX-2',
      status: 'in-progress' as const,
      position: 0,
    }
    const snapshot: TaskBoardSnapshot = {
      todo: {
        items: [TASK],
        totalCount: 4,
        pageInfo: { nextToken: 'todo-next' },
      },
      'in-progress': {
        items: [other],
        totalCount: 3,
        pageInfo: { nextToken: 'progress-next' },
      },
      done: { items: [], totalCount: 0, pageInfo: {} },
    }
    const moved = { ...TASK, status: 'in-progress' as const, position: 1 }

    const result = reconcileMovedTask(snapshot, {
      task: moved,
      previousStatus: 'todo',
      affectedTasks: [other, moved],
    })

    assert.deepEqual(result.todo, { items: [], totalCount: 3, pageInfo: {} })
    assert.deepEqual(result['in-progress'], {
      items: [other, moved],
      totalCount: 4,
      pageInfo: {},
    })
    assert.equal(result.done, snapshot.done)
  })

  it('uses the loaded source status when a move result races the snapshot', () => {
    const staleLoaded = { ...TASK, status: 'done' as const }
    const snapshot: TaskBoardSnapshot = {
      todo: {
        items: [],
        totalCount: 4,
        pageInfo: { nextToken: 'todo-next' },
      },
      'in-progress': { items: [], totalCount: 1, pageInfo: {} },
      done: {
        items: [staleLoaded],
        totalCount: 2,
        pageInfo: { nextToken: 'done-next' },
      },
    }
    const moved = { ...TASK, status: 'in-progress' as const }

    const result = reconcileMovedTask(snapshot, {
      task: moved,
      previousStatus: 'todo',
      affectedTasks: [moved],
    })

    assert.equal(result.todo, snapshot.todo)
    assert.deepEqual(result.done, { items: [], totalCount: 1, pageInfo: {} })
    assert.deepEqual(result['in-progress'], {
      items: [moved],
      totalCount: 2,
      pageInfo: {},
    })
  })
})

function createSnapshot(todo: TaskPage): TaskBoardSnapshot {
  const emptyPage = { items: [], totalCount: 0, pageInfo: {} }
  return { todo, 'in-progress': emptyPage, done: emptyPage }
}
