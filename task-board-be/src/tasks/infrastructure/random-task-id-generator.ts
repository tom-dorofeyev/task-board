import { randomUUID } from 'node:crypto';
import type { TaskIdGenerator } from '../application/task-id-generator.js';

export class RandomTaskIdGenerator implements TaskIdGenerator {
  next(): string {
    return randomUUID();
  }
}
