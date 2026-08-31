import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeTaskDraft,
  validateTaskDraft,
} from '../../src/task-board/domain/taskValidation'

describe('task draft validation', () => {
  it('requires a title and assignee', () => {
    const errors = validateTaskDraft({
      title: ' ',
      description: '',
      status: 'todo',
      priority: 'low',
      assignee: '',
      labels: [],
    })

    assert.deepEqual(errors, {
      title: 'Title is required.',
      assignee: 'Assignee is required.',
    })
  })

  it('normalizes submitted fields', () => {
    const updated = normalizeTaskDraft({
      title: ' Updated ',
      description: 'Details',
      status: 'done',
      priority: 'high',
      assignee: ' Avery ',
      labels: ['UX', 'Customer'],
    })

    assert.deepEqual(
      {
        title: updated.title,
        assignee: updated.assignee,
        labels: updated.labels,
      },
      { title: 'Updated', assignee: 'Avery', labels: ['UX', 'Customer'] },
    )
  })
})
