import type { Address } from 'viem'
import { DeltaCallType, LendingCall, Lender } from '@1delta/lib-utils'
import type { ActionCall } from '../../actions/shared/types'

export interface RequiredApproval {
  token: Address
  spender: Address
  amount: bigint
}

export interface LendingApproval {
  lender: Lender
  token: Address
  spender: Address
  amount: bigint
  underlyingAmount?: bigint
  underlyingTokenAddress?: Address
}

export function extractMTokenApprovals(
  inputCalls: ActionCall[],
  composerAddress: Address
): RequiredApproval[] {
  const approvals: RequiredApproval[] = []

  for (const call of inputCalls) {
    if (
      call.callType === DeltaCallType.LENDING &&
      (call as any).lendingAction === LendingCall.DeltaCallLendingAction.WITHDRAW &&
      (call as any).useOverride?.pool
    ) {
      const mTokenAddress = (call as any).useOverride.pool as Address
      approvals.push({
        token: mTokenAddress,
        spender: composerAddress,
        amount: 0n,
      })
    }
  }

  return approvals
}

export function extractLendingApprovals(
  inputCalls: ActionCall[],
  composerAddress: Address
): LendingApproval[] {
  const approvals: LendingApproval[] = []

  for (const call of inputCalls) {
    if (
      call.callType === DeltaCallType.LENDING &&
      (call as any).lendingAction === LendingCall.DeltaCallLendingAction.WITHDRAW &&
      (call as any).useOverride?.pool
    ) {
      const mTokenAddress = (call as any).useOverride.pool as Address
      const lender = (call as any).lender as Lender | undefined
      const underlyingAmount = (call as any).amount as bigint | undefined
      const underlyingTokenAddress = (call as any).tokenAddress as Address | undefined

      if (lender) {
        approvals.push({
          lender,
          token: mTokenAddress,
          spender: composerAddress,
          amount: 0n,
          underlyingAmount,
          underlyingTokenAddress,
        })
      }
    }
  }

  return approvals
}
