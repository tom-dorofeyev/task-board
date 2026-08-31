import type { TaskCommands, UpdateTaskInput } from '../ports/TaskCommands'
import { normalizeValidTaskDraft } from '../../domain/taskValidation'

export class UpdateTask {
  private readonly commands: TaskCommands

  constructor(commands: TaskCommands) {
    this.commands = commands
  }

  execute(input: UpdateTaskInput) {
    return this.commands.updateTask({
      id: input.id,
      task: normalizeValidTaskDraft(input.task),
    })
  }
}
