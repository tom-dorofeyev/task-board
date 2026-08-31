import type { CreateTaskInput, TaskCommands } from '../ports/TaskCommands'
import { normalizeValidTaskDraft } from '../../domain/taskValidation'
import { requireCreateTaskIntentId } from '../CreateTaskIntentId'

export class CreateTask {
  private readonly commands: TaskCommands

  constructor(commands: TaskCommands) {
    this.commands = commands
  }

  execute(input: CreateTaskInput) {
    return this.commands.createTask({
      idempotencyKey: requireCreateTaskIntentId(input.idempotencyKey),
      task: normalizeValidTaskDraft(input.task),
    })
  }
}
