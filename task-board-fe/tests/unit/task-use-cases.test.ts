import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CreateTask } from '../../src/task-board/application/use-cases/CreateTask'
import { UpdateTask } from '../../src/task-board/application/use-cases/UpdateTask'
import { MoveTask } from '../../src/task-board/application/use-cases/MoveTask'
import { DeleteTask } from '../../src/task-board/application/use-cases/DeleteTask'
import { CreateTaskIntentValidationError } from '../../src/task-board/application/CreateTaskIntentId'
import type {
  CreateTaskInput,
  DeleteTaskInput,
  TaskCommands,
  UpdateTaskInput,
  MoveTaskInput,
} from '../../src/task-board/application/ports/TaskCommands'
import type { Task } from '../../src/task-board/domain/task'
import { TaskDraftValidationError } from '../../src/task-board/domain/taskValidation'

const TODO: Task = {
  id: 'todo',
  key: 'NEX-1',
  title: 'Todo',
  description: '',
  status: 'todo',
  priority: 'low',
  assignee: 'Sam',
  labels: [],
  position: 0,
}

describe('MoveTask', () => {
  it('forwards one anchored move command and returns its authoritative result', async () => {
    const commands = new CapturingCommands()
    const move = new MoveTask(commands)
    const input: MoveTaskInput = {
      taskId: TODO.id,
      targetStatus: 'done',
      beforeTaskId: 'done-anchor',
    }

    const result = await move.execute(input)

    assert.deepEqual(commands.moved, input)
    assert.deepEqual(result, {
      task: TODO,
      previousStatus: TODO.status,
      affectedTasks: [TODO],
    })
  })
})

describe('DeleteTask', () => {
  it('forwards the selected task ID to the command port', async () => {
    const commands = new CapturingCommands()

    await new DeleteTask(commands).execute({ id: TODO.id })

    assert.deepEqual(commands.deleted, { id: TODO.id })
  })
})

describe('UpdateTask', () => {
  it('returns the authoritative updated entity', async () => {
    const commands = new CapturingCommands()
    const update = new UpdateTask(commands)

    const result = await update.execute({
      id: TODO.id,
      task: { ...taskDraft(), status: 'done' },
    })

    assert.deepEqual(result, { ...TODO, status: 'done' })
  })

  it('rejects invalid input before invoking the command port', async () => {
    const commands = new CapturingCommands()
    const update = new UpdateTask(commands)

    assert.throws(
      () =>
        update.execute({
          id: TODO.id,
          task: { ...taskDraft(), title: ' ', assignee: '' },
        }),
      TaskDraftValidationError,
    )
    assert.equal(commands.updated, null)
  })
})

describe('CreateTask', () => {
  it('sends identity-free input and returns the authoritative entity', async () => {
    const commands = new CapturingCommands()
    const create = new CreateTask(commands)
    const input: CreateTaskInput = {
      idempotencyKey: 'create-intent-1',
      task: { ...taskDraft(), title: ` ${TODO.title} ` },
    }

    const result = await create.execute(input)

    assert.deepEqual(
      { input: commands.created, result },
      {
        input: { ...input, task: { ...input.task, title: TODO.title } },
        result: TODO,
      },
    )
  })

  it('rejects invalid input before invoking the command port', async () => {
    const commands = new CapturingCommands()
    const create = new CreateTask(commands)

    assert.throws(
      () =>
        create.execute({
          idempotencyKey: 'create-intent-2',
          task: { ...taskDraft(), title: '', assignee: ' ' },
        }),
      (error: unknown) => {
        assert.ok(error instanceof TaskDraftValidationError)
        assert.deepEqual(error.errors, {
          title: 'Title is required.',
          assignee: 'Assignee is required.',
        })
        return true
      },
    )
    assert.equal(commands.created, null)
  })

  it('rejects a blank create intent before invoking the command port', () => {
    const commands = new CapturingCommands()
    const create = new CreateTask(commands)

    assert.throws(
      () =>
        create.execute({
          idempotencyKey: '   ',
          task: taskDraft(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof CreateTaskIntentValidationError)
        assert.equal(error.field, 'idempotencyKey')
        return true
      },
    )
    assert.equal(commands.created, null)
  })
})

class CapturingCommands implements TaskCommands {
  created: CreateTaskInput | null = null
  updated: UpdateTaskInput | null = null
  moved: MoveTaskInput | null = null
  deleted: DeleteTaskInput | null = null

  async createTask(input: CreateTaskInput): Promise<Task> {
    this.created = input
    return TODO
  }

  async updateTask(input: UpdateTaskInput): Promise<Task> {
    this.updated = input
    return { ...TODO, ...input.task }
  }

  async deleteTask(input: DeleteTaskInput): Promise<void> {
    this.deleted = input
  }

  async moveTask(input: MoveTaskInput) {
    this.moved = input
    return {
      task: TODO,
      previousStatus: TODO.status,
      affectedTasks: [TODO],
    }
  }
}

function taskDraft(): CreateTaskInput['task'] {
  return {
    title: TODO.title,
    description: TODO.description,
    status: TODO.status,
    priority: TODO.priority,
    assignee: TODO.assignee,
    labels: TODO.labels,
  }
}
