import type { GenericTrade } from '@1delta/lib-utils'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { zeroAddress } from 'viem'
import { createApproveTransaction } from '@1delta/calldata-sdk'

export type ExecutionEventType =
  | 'approval:start'
  | 'approval:sent'
  | 'approval:confirmed'
  | 'tx:signing'
  | 'tx:sent'
  | 'tx:confirmed'
  | 'tracking'
  | 'update'
  | 'done'
  | 'error'
  | 'timeout'

export interface ExecutionEvent {
  type: ExecutionEventType
  src?: string
  dst?: string
  completed?: boolean
  txHash?: string
  error?: Error
  status?: string
  raw?: unknown
  reason?: string
}

export interface ExecutionResult {
  srcHash?: string
  dstHash?: string
  completed: boolean
}

export interface ApprovalInfo {
  token: Address
  spender: Address
  requiredAmount: bigint
  needsApproval: boolean
  approvalTransaction?: {
    to: Address
    data: Hex
    value?: bigint
  }
}

export interface ExecutionOptions {
  walletClient: WalletClient
  publicClient: PublicClient
  tokenApproval?: ApprovalInfo
  additionalApprovals?: ApprovalInfo[]
  onEvent?: (event: ExecutionEvent) => void
}

export interface ExecutionPipeline {
  execute: () => Promise<ExecutionResult>
  cancel: () => void
}

export function isBridgeTrade(trade: GenericTrade): boolean {
  return trade?.inputAmount.currency.chainId !== trade?.outputAmount.currency.chainId
}

async function getTransactionData(trade: GenericTrade): Promise<{
  to: Address
  data: Hex
  value: bigint
} | null> {
  if (!trade) return null

  if ('assemble' in trade && typeof (trade as any).assemble === 'function') {
    const assembled = await (trade as any).assemble()
    const assembledItems = Array.isArray(assembled) ? assembled : [assembled]

    for (const item of assembledItems) {
      if (item && 'EVM' in item && (item as any).EVM) {
        const tx = (item as any).EVM
        const calldata = (tx as any).calldata ?? (tx as any).data
        return {
          to: (tx as any).to,
          data: calldata,
          value: (tx as any).value ?? 0n,
        }
      }

      if (item && (item as any).transaction) {
        const tx = (item as any).transaction
        const calldata = (tx as any).calldata ?? (tx as any).data
        if (tx && calldata && (tx as any).to) {
          return {
            to: (tx as any).to,
            data: calldata,
            value: (tx as any).value ?? 0n,
          }
        }
      }

      if (item && (item as any).to && ((item as any).calldata || (item as any).data)) {
        const calldata = (item as any).calldata ?? (item as any).data
        return {
          to: (item as any).to,
          data: calldata,
          value: (item as any).value ?? 0n,
        }
      }
    }
  }

  throw new Error('No assemble function found')
}

async function executeApproval(
  approval: ApprovalInfo,
  walletClient: WalletClient,
  publicClient: PublicClient,
  emit: (event: ExecutionEvent) => void
): Promise<void> {
  if (!approval.needsApproval || approval.token === zeroAddress) {
    return
  }

  emit({ type: 'approval:start' })

  let txHash: string

  if (approval.approvalTransaction) {
    const tx = approval.approvalTransaction
    txHash = await walletClient.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value || 0n,
      account: walletClient.account?.address!,
      chain: walletClient.chain!,
    })
  } else {
    const approveTx = createApproveTransaction(
      walletClient.chain?.id?.toString()!,
      walletClient.account?.address!,
      approval.spender,
      approval.token,
      approval.requiredAmount
    )
    txHash = await walletClient.sendTransaction({
      to: approveTx.to as Address,
      data: approveTx.data as Hex,
      value: approveTx.value || 0n,
      account: walletClient.account?.address!,
      chain: walletClient.chain!,
    })
  }

  emit({ type: 'approval:sent', txHash })

  await publicClient.waitForTransactionReceipt({ hash: txHash as Hex })

  emit({ type: 'approval:confirmed', txHash })
}

export function createExecutionPipeline(
  trade: GenericTrade,
  options: ExecutionOptions
): ExecutionPipeline {
  const { walletClient, publicClient, tokenApproval, additionalApprovals, onEvent } = options

  let cancelled = false

  const emit = (event: ExecutionEvent) => {
    onEvent?.(event)
  }

  const execute = async (): Promise<ExecutionResult> => {
    try {
      const allApprovals: ApprovalInfo[] = [
        ...(additionalApprovals || []),
        ...(tokenApproval ? [tokenApproval] : []),
      ]

      for (const approval of allApprovals) {
        if (cancelled) throw new Error('Cancelled')
        await executeApproval(approval, walletClient, publicClient, emit)
      }

      if (cancelled) throw new Error('Cancelled')

      emit({ type: 'tx:signing' })

      const txData = await getTransactionData(trade)
      if (!txData) throw new Error('Transaction creation failed')

      const txHash = await walletClient.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: txData.value,
        account: walletClient.account?.address!,
        chain: walletClient.chain!,
      })

      emit({ type: 'tx:sent', src: txHash })

      await publicClient.waitForTransactionReceipt({ hash: txHash as Hex })

      emit({ type: 'tx:confirmed', src: txHash })

      if (isBridgeTrade(trade)) {
        emit({ type: 'tracking', src: txHash })
        return { srcHash: txHash, completed: true }
      }

      emit({ type: 'done', src: txHash })
      return { srcHash: txHash, completed: true }
    } catch (error) {
      emit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) })
      return { completed: false }
    }
  }

  const cancel = () => {
    cancelled = true
  }

  return { execute, cancel }
}

export interface ExecutionStep {
  name: string
  execute: () => Promise<void>
  canSkip?: () => boolean
}

export function createSteppedPipeline(steps: ExecutionStep[]): {
  run: () => Promise<void>
  getCompletedSteps: () => string[]
} {
  const completedSteps: string[] = []

  const run = async () => {
    for (const step of steps) {
      if (step.canSkip?.()) {
        continue
      }
      await step.execute()
      completedSteps.push(step.name)
    }
  }

  return {
    run,
    getCompletedSteps: () => [...completedSteps],
  }
}

