import { GenericTrade } from '@1delta/lib-utils'
import { getStatusFromTrade } from './getStatusFromTrade'
import { ExecutionEvent, ExecutionEventType } from './types'

export async function trackTradeCompletion(
  srcHash: string,
  trade: GenericTrade,
  emit: (event: ExecutionEvent) => void
): Promise<{ src?: string; dst?: string; completed?: boolean; type: ExecutionEventType }> {
  if (!trade) {
    emit({ type: 'done', src: srcHash })
    return { type: 'done', src: srcHash, completed: true }
  }

  try {
    const maxAttempts = 60
    const delayMs = 5000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await getStatusFromTrade(srcHash, trade)
        const statusInfo = status?.statusInfo
        const actionStatus = statusInfo?.status

        const dst = status?.toHash
        // Emit raw status every iteration for UI debugging or display
        emit({
          type: 'update',
          status: actionStatus ?? 'UNKNOWN',
          src: srcHash,
          dst,
          raw: status,
        })

        // --- COMPLETED / DONE ---
        if (actionStatus === 'DONE') {
          emit({
            type: 'done',
            src: srcHash,
            dst,
          })

          return {
            type: 'done',
            src: srcHash,
            dst,
            completed: true,
          }
        }

        // --- FAILURE STATUSES ---
        if (
          actionStatus === 'FAILED' ||
          actionStatus === 'TRANSFER_REFUNDED' ||
          actionStatus === 'INVALID'
        ) {
          const errorMessage = statusInfo?.message || 'Bridge transaction failed'

          emit({
            type: 'error',
            src: srcHash,
            reason: `Bridge failed: ${actionStatus} – ${errorMessage}`,
          })

          return { type: 'error', src: srcHash, dst, completed: false }
        }
      } catch (err) {
        emit({
          type: 'error',
          src: srcHash,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    // Timeout after max attempts
    emit({
      type: 'timeout',
      src: srcHash,
    })

    return { type: 'timeout', src: srcHash, completed: false }
  } catch (err) {
    emit({
      type: 'error',
      src: srcHash,
      error: err instanceof Error ? err : new Error(String(err)),
    })

    return { type: 'error', src: srcHash, completed: false }
  }
}
