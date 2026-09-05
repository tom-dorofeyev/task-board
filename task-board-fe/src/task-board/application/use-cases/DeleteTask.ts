import type { DeleteTaskInput, TaskCommands } from '../ports/TaskCommands'

export class DeleteTask {
  private readonly commands: TaskCommands

  constructor(commands: TaskCommands) {
    this.commands = commands
  }

  execute(input: DeleteTaskInput): Promise<void> {
    return this.commands.deleteTask(input)
  }
}
