import { GenericTrade } from '@1delta/lib-utils'
import type { PublicClient, WalletClient } from 'viem'
import { zeroAddress } from 'viem'
import { getTransactionData } from './getTransactionData'
import { UniversalToken } from '@1delta/calldata-sdk'
import { isBridge } from './isBridge'
import { ExecutionEvent, ExecutionTracker } from './types'
import { trackTradeCompletion } from './trackTradeCompletion'

export function executeTrade(args: {
  trade: GenericTrade
  walletClient: WalletClient
  publicClient: PublicClient
  needsApproval: boolean
}): ExecutionTracker {
  const listeners = new Set<(e: ExecutionEvent) => void>()
  let cancelled = false
  const emit = (event: ExecutionEvent) => {
    listeners.forEach((l) => l(event))
  }

  const tracker: ExecutionTracker = {
    on: (listener) => listeners.add(listener),
    off: (listener) => listeners.delete(listener),
    cancel: () => {
      cancelled = true
    },
    done: null as any,
  }

  tracker.done = (async () => {
    await Promise.resolve() // required for listeners to be registered before event emitting
    try {
      // -----------------------------------------------------
      // 1. APPROVAL
      // -----------------------------------------------------
      if (args.needsApproval && args.trade?.inputAmount.currency.address !== zeroAddress) {
        emit({ type: 'approval:start' })

        // @ts-ignore
        const approvalTxHash = await args.walletClient.sendTransaction({
          to: args.trade?.inputAmount.currency.address as any,
          data: UniversalToken.encodeApprove(
            args.trade.target as any,
            args.trade?.inputAmount.amount
          ),
          value: 0n,
        })

        emit({ type: 'approval:sent', txHash: approvalTxHash })

        await args.publicClient.waitForTransactionReceipt({ hash: approvalTxHash })

        emit({ type: 'approval:confirmed', txHash: approvalTxHash })
      }

      if (cancelled) throw new Error('Cancelled')

      // -----------------------------------------------------
      // 2. SIGN + SEND MAIN TRANSACTION
      // -----------------------------------------------------
      emit({ type: 'tx:signing' })

      const txData = await getTransactionData(args.trade)

      if (!txData) throw new Error('Transaction creation failed')

      const txHash = await args.walletClient.sendTransaction(txData as any)

      emit({ type: 'tx:sent', src: txHash })

      await args.publicClient.waitForTransactionReceipt({ hash: txHash })

      emit({ type: 'tx:confirmed', src: txHash })

      // -----------------------------------------------------
      // 3. BRIDGE TRACKING
      // -----------------------------------------------------
      if (isBridge(args.trade)) {
        emit({ type: 'tracking', srcHash: txHash })

        const eventSummary = await trackTradeCompletion(txHash, args.trade, emit)

        emit(eventSummary)

        return { srcHash: txHash, dstHash: eventSummary.dst, completed: true }
      }

      // -----------------------------------------------------
      // 4. NO BRIDGE → DONE
      // -----------------------------------------------------
      emit({ type: 'done', src: txHash })
      return { srcHash: txHash, completed: true }
    } catch (error: any) {
      emit({ type: 'error', error })
      return { completed: false }
    }
  })()

  return tracker
}
