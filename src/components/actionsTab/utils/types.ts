export interface ExecutionEvent {
  type: string
  [key: string]: any
}

export interface ExecutionTracker {
  on(listener: (event: ExecutionEvent) => void): void
  off(listener: (event: ExecutionEvent) => void): void
  done: Promise<ExecutionResult>
  cancel(): void
}

export interface ExecutionResult {
  srcHash?: string
  dstHash?: string
  completed: boolean
}
