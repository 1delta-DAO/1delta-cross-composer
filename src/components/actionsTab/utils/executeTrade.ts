import { GenericTrade } from '@1delta/lib-utils'
import type { Hex, PublicClient, WalletClient } from 'viem'
import { zeroAddress } from 'viem'
import { getTransactionData } from './getTransactionData'
import { createApproveTransaction } from '@1delta/calldata-sdk'
import { isBridge } from './isBridge'
import { ExecutionEvent, ExecutionTracker } from './types'
import { trackTradeCompletion } from './trackTradeCompletion'
import type { LendingApprovalInfo } from '../hooks/useLendingApprovals'

export function executeTrade(args: {
  trade: GenericTrade
  walletClient: WalletClient
  publicClient: PublicClient
  needsApproval: boolean
  mTokenApprovals?: LendingApprovalInfo[]
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
      // 1. APPROVALS
      // -----------------------------------------------------
      if (args.mTokenApprovals && args.mTokenApprovals.length > 0) {
        for (const approval of args.mTokenApprovals) {
          if (approval.needsApproval && approval.token !== zeroAddress) {
            emit({ type: 'approval:start' })

            let approvalTxHash: string

            if (approval.approvalTransaction) {
              const tx = approval.approvalTransaction
              approvalTxHash = await args.walletClient.sendTransaction({
                to: tx.to as any,
                data: tx.data as any,
                value: tx.value || 0n,
                account: args.walletClient.account?.address!,
                chain: args.walletClient.chain!,
              })
            } else {
              const approveTx = createApproveTransaction(
                args.walletClient.chain?.id?.toString()!,
                args.walletClient.account?.address!,
                approval.spender,
                approval.token,
                approval.requiredAmount
              )
              approvalTxHash = await args.walletClient.sendTransaction({
                to: approveTx.to as any,
                data: approveTx.data as any,
                value: approveTx.value || 0n,
                account: args.walletClient.account?.address!,
                chain: args.walletClient.chain!,
              })
            }
            emit({ type: 'approval:sent', txHash: approvalTxHash })

            await args.publicClient.waitForTransactionReceipt({ hash: approvalTxHash as Hex })

            emit({ type: 'approval:confirmed', txHash: approvalTxHash })

            if (cancelled) throw new Error('Cancelled')
          }
        }
      }

      if (args.needsApproval && args.trade?.inputAmount.currency.address !== zeroAddress) {
        emit({ type: 'approval:start' })

        const approveTx = createApproveTransaction(
          args.walletClient.chain?.id?.toString()!,
          args.walletClient.account?.address!,
          args.trade.target as any,
          args.trade?.inputAmount.currency.address as any,
          args.trade?.inputAmount.amount
        )

        const approvalTxHash = await args.walletClient.sendTransaction({
          to: approveTx.to as any,
          data: approveTx.data as any,
          value: approveTx.value || 0n,
          account: args.walletClient.account?.address!,
          chain: args.walletClient.chain!,
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
