import type { MoveTaskInput, TaskCommands } from '../ports/TaskCommands'

export class MoveTask {
  private readonly commands: TaskCommands
  constructor(commands: TaskCommands) {
    this.commands = commands
  }

  execute(input: MoveTaskInput) {
    return this.commands.moveTask(input)
  }
}
