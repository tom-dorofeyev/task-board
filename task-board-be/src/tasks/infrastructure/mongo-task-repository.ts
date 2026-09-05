import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Schema, createConnection, type Model } from 'mongoose';
import type {
  CreateReplay,
  TaskRepository,
} from '../application/task-repository.js';
import type { Task } from '../domain/task.js';

const STATE_ID = 'task-board-state';

export interface PersistedTaskState {
  tasks: Task[];
  nextTaskNumber: number;
  createReplays: Record<string, CreateReplay>;
}

interface PersistedTaskStateDocument extends PersistedTaskState {
  id: string;
}

export interface TaskStateStore {
  load(): Promise<PersistedTaskState | undefined>;
  save(state: PersistedTaskState): Promise<void>;
}

@Injectable()
export class MongoTaskRepository implements TaskRepository, OnModuleDestroy {
  private readonly tasks: Task[];
  private readonly createReplays: Map<string, CreateReplay>;
  private nextTaskNumber: number;
  private persistedState: PersistedTaskState;

  private constructor(
    private readonly store: TaskStateStore,
    private readonly closeConnection: () => Promise<void>,
    state: PersistedTaskState,
  ) {
    this.tasks = state.tasks;
    this.createReplays = new Map(Object.entries(state.createReplays));
    this.nextTaskNumber = state.nextTaskNumber;
    this.persistedState = cloneState(state);
  }

  static async connect(uri: string): Promise<MongoTaskRepository> {
    const connection = await createConnection(uri).asPromise();
    try {
      return await this.fromConnection(connection);
    } catch (error) {
      await connection.close();
      throw error;
    }
  }

  static async fromStore(
    store: TaskStateStore,
    closeConnection: () => Promise<void> = async () => {},
  ): Promise<MongoTaskRepository> {
    return new MongoTaskRepository(
      store,
      closeConnection,
      (await store.load()) ?? emptyState(),
    );
  }

  async all(): Promise<Task[]> {
    return this.tasks;
  }

  async find(taskId: string): Promise<Task | undefined> {
    return this.tasks.find((task) => task.id === taskId);
  }

  async add(task: Task): Promise<void> {
    this.tasks.push(task);
  }

  async nextKey(): Promise<string> {
    return `NEX-${this.nextTaskNumber++}`;
  }

  async findCreateReplay(key: string): Promise<CreateReplay | undefined> {
    return this.createReplays.get(key);
  }

  async saveCreateReplay(key: string, replay: CreateReplay): Promise<void> {
    this.createReplays.set(key, replay);
  }

  async flush(): Promise<void> {
    try {
      await this.store.save(this.state());
      this.persistedState = cloneState(this.state());
    } catch (error) {
      this.restore(this.persistedState);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeConnection();
  }

  private state(): PersistedTaskState {
    return {
      tasks: this.tasks,
      nextTaskNumber: this.nextTaskNumber,
      createReplays: Object.fromEntries(this.createReplays),
    };
  }

  private static async fromConnection(
    connection: ReturnType<typeof createConnection>,
  ): Promise<MongoTaskRepository> {
    const model = connection.model<PersistedTaskStateDocument>(
      'TaskBoardState',
      taskStateSchema,
    );
    return this.fromStore(new MongooseTaskStateStore(model), () =>
      connection.close(),
    );
  }

  private restore(state: PersistedTaskState): void {
    this.tasks.splice(0, this.tasks.length, ...cloneTasks(state.tasks));
    this.createReplays.clear();
    Object.entries(state.createReplays).forEach(([key, replay]) =>
      this.createReplays.set(key, { ...replay }),
    );
    this.nextTaskNumber = state.nextTaskNumber;
  }
}

class MongooseTaskStateStore implements TaskStateStore {
  constructor(private readonly model: Model<PersistedTaskStateDocument>) {}

  async load(): Promise<PersistedTaskState | undefined> {
    const state = await this.model.findOne({ id: STATE_ID }).lean().exec();
    return state ? stateFromDocument(state) : undefined;
  }

  async save(state: PersistedTaskState): Promise<void> {
    await this.model
      .findOneAndUpdate(
        { id: STATE_ID },
        { id: STATE_ID, ...state },
        { upsert: true, new: true },
      )
      .exec();
  }
}

const taskStateSchema = new Schema<PersistedTaskStateDocument>(
  {
    id: { type: String, required: true, unique: true },
    tasks: { type: Schema.Types.Mixed, required: true },
    nextTaskNumber: { type: Number, required: true },
    createReplays: { type: Schema.Types.Mixed, required: true },
  },
  { versionKey: false, strict: 'throw' },
);

function emptyState(): PersistedTaskState {
  return { tasks: [], nextTaskNumber: 1, createReplays: {} };
}

function stateFromDocument(state: PersistedTaskState): PersistedTaskState {
  return {
    tasks: cloneTasks(state.tasks),
    nextTaskNumber: state.nextTaskNumber,
    createReplays: Object.fromEntries(
      Object.entries(state.createReplays).map(([key, replay]) => [
        key,
        { ...replay },
      ]),
    ),
  };
}

function cloneState(state: PersistedTaskState): PersistedTaskState {
  return stateFromDocument(state);
}

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({ ...task, labels: [...task.labels] }));
}
