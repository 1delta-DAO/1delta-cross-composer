import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'
import { DeltaCallType, LendingCall } from '@1delta/lib-utils'

export interface InputValidationResult {
  isValid: boolean
  isSameChain: boolean
  shouldFetch: boolean
  reason?: string
}

export function validateInputs(
  srcAmount?: RawCurrencyAmount,
  dstCurrency?: RawCurrency,
  inputCalls?: any[]
): InputValidationResult {
  const hasWithdrawMax = inputCalls?.some(
    (call) =>
      call?.callType === DeltaCallType.LENDING &&
      call?.lendingAction === LendingCall.DeltaCallLendingAction.WITHDRAW &&
      call?.amount === 0n
  )
  
  const amountOk = !!srcAmount && (srcAmount.amount > 0n || hasWithdrawMax)
  const srcCurrencyOk = Boolean(srcAmount?.currency)
  const dstCurrencyOk = Boolean(dstCurrency)

  if (!amountOk || !srcCurrencyOk || !dstCurrencyOk) {
    return {
      isValid: false,
      isSameChain: false,
      shouldFetch: false,
      reason: !amountOk ? 'Invalid amount' : 'Missing currency',
    }
  }

  const isSameChain = srcAmount!.currency.chainId === dstCurrency!.chainId

  return {
    isValid: true,
    isSameChain,
    shouldFetch: true,
  }
}

export function detectChainTransition(
  currentIsSameChain: boolean,
  previousIsSameChain: boolean | null
): boolean {
  return previousIsSameChain !== null && previousIsSameChain !== currentIsSameChain
}
