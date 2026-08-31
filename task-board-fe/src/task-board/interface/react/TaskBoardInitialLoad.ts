import type { TaskBoardPageController } from '../../application/TaskBoardPageController'
import type { TaskBoardSnapshot } from '../../application/ports/TaskQueries'
import type { TaskBoardPageWindows } from '../../application/taskPageWindow'
import type { LoadTaskBoard } from '../../application/use-cases/LoadTaskBoard'
import { TASK_STATUSES } from '../../domain/task'

export type TaskBoardLoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      taskBoard: TaskBoardSnapshot
      pageWindows: TaskBoardPageWindows
    }
  | { status: 'error'; message: string }

export class TaskBoardInitialLoad {
  private readonly loadTaskBoard: LoadTaskBoard
  private readonly pageController: TaskBoardPageController
  private readonly publishLoadState: (state: TaskBoardLoadState) => void
  private readonly reportError: (error: unknown) => void
  private activeGeneration: number | undefined
  private activeBatch: InitialPageBatch | undefined
  private generation = 0
  private hasReachedReady = false
  private acceptsControllerTransitions = false

  constructor(options: {
    loadTaskBoard: LoadTaskBoard
    pageController: TaskBoardPageController
    publishLoadState(state: TaskBoardLoadState): void
    reportError?(error: unknown): void
  }) {
    this.loadTaskBoard = options.loadTaskBoard
    this.pageController = options.pageController
    this.publishLoadState = options.publishLoadState
    this.reportError = options.reportError ?? reportPresentationError
  }

  readonly publishPageWindows = (pageWindows: TaskBoardPageWindows): void => {
    if (!this.isActive()) return
    if (this.acceptsControllerTransitions) {
      this.publishReady(pageWindows)
      return
    }
    if (
      !isActiveBatchComplete(
        pageWindows,
        this.activeBatch,
        this.activeGeneration,
      )
    )
      return
    this.hasReachedReady = true
    this.acceptsControllerTransitions = true
    this.activeBatch = undefined
    this.publishReady(pageWindows)
  }

  start(): void {
    const generation = ++this.generation
    this.activeGeneration = generation
    this.activeBatch = undefined
    this.acceptsControllerTransitions = false
    void this.load(generation)
  }

  stop(): void {
    this.activeGeneration = undefined
    this.activeBatch = undefined
  }

  private async load(generation: number): Promise<void> {
    try {
      await this.loadTaskBoard.initialize()
    } catch {
      this.handleBootstrapFailure(generation)
      return
    }
    if (!this.isCurrent(generation)) return
    this.startInitialPageBatch(generation)
  }

  private startInitialPageBatch(generation: number): void {
    const requests = TASK_STATUSES.map((status) =>
      this.pageController.loadInitial(status),
    )
    const batch: InitialPageBatch = {
      lifecycleGeneration: generation,
      requestGenerations: {
        todo: this.pageController.getState().todo.requestGeneration,
        'in-progress':
          this.pageController.getState()['in-progress'].requestGeneration,
        done: this.pageController.getState().done.requestGeneration,
      },
    }
    this.activeBatch = batch
    void Promise.all(requests).then(
      () => this.publishBatchReady(generation, batch),
      () => this.publishBatchFailure(generation, batch),
    )
  }

  private handleBootstrapFailure(generation: number): void {
    if (!this.isCurrent(generation)) return
    if (this.hasReachedReady) {
      this.acceptsControllerTransitions = true
      this.publishReady(this.pageController.getState())
      return
    }
    this.publishState({
      status: 'error',
      message: 'We could not read your saved board.',
    })
  }

  private publishBatchReady(generation: number, batch: InitialPageBatch): void {
    if (
      !this.isCurrentBatch(generation, batch) ||
      this.acceptsControllerTransitions
    ) {
      return
    }
    this.hasReachedReady = true
    this.acceptsControllerTransitions = true
    this.activeBatch = undefined
    this.publishReady(this.pageController.getState())
  }

  private publishBatchFailure(
    generation: number,
    batch: InitialPageBatch,
  ): void {
    if (!this.isCurrentBatch(generation, batch)) return
    if (this.hasReachedReady) {
      this.acceptsControllerTransitions = true
      this.activeBatch = undefined
      this.publishReady(this.pageController.getState())
      return
    }
    this.publishState({
      status: 'error',
      message: 'We could not read your saved board.',
    })
  }

  private publishReady(pageWindows: TaskBoardPageWindows): void {
    this.publishState({
      status: 'ready',
      taskBoard: {
        todo: pageWindows.todo.page,
        'in-progress': pageWindows['in-progress'].page,
        done: pageWindows.done.page,
      },
      pageWindows,
    })
  }

  private publishState(state: TaskBoardLoadState): void {
    try {
      this.publishLoadState(state)
    } catch (error) {
      this.reportError(error)
    }
  }

  private isActive(): boolean {
    return this.activeGeneration !== undefined
  }

  private isCurrent(generation: number): boolean {
    return this.activeGeneration === generation
  }

  private isCurrentBatch(generation: number, batch: InitialPageBatch): boolean {
    return this.isCurrent(generation) && this.activeBatch === batch
  }
}

interface InitialPageBatch {
  readonly lifecycleGeneration: number
  readonly requestGenerations: Readonly<
    Record<(typeof TASK_STATUSES)[number], number>
  >
}

const isActiveBatchComplete = (
  pageWindows: TaskBoardPageWindows,
  batch: InitialPageBatch | undefined,
  activeGeneration: number | undefined,
): boolean =>
  batch !== undefined &&
  batch.lifecycleGeneration === activeGeneration &&
  TASK_STATUSES.every(
    (status) =>
      pageWindows[status].requestGeneration ===
        batch.requestGenerations[status] &&
      pageWindows[status].initialRequest.status === 'idle',
  )

const reportPresentationError = (error: unknown): void => {
  console.error(error)
}
