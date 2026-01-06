import { type Address } from 'viem'
import { getTokenFromCache } from '../data/tokenListsCache'
import type { RawCurrency } from '../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import type { ActionCall } from '../../components/actions/shared/types'
import type { DeltaCall, PostDeltaCall, PreDeltaCall } from '@1delta/lib-utils'
import { DeltaCallType } from '@1delta/lib-utils'

export function getCurrency(
  chainId: string,
  tokenAddress: Address | undefined
): RawCurrency | undefined {
  if (!tokenAddress || !chainId) {
    return undefined
  }
  const token = getTokenFromCache(chainId, tokenAddress)
  return token
}

export function convertAmountToWei(amount: string, decimals: number): string {
  try {
    const num = Number(amount)
    if (!Number.isFinite(num) || num <= 0) {
      return '0'
    }
    const raw = CurrencyHandler.parseNumberToRaw(num, decimals)
    return raw.toString()
  } catch {
    return '0'
  }
}

export function convertActionCallsToDeltaCalls(calls: ActionCall[]): DeltaCall[] {
  return calls.map((c) => {
    const { gasLimit, ...deltaCall } = c
    return deltaCall
  })
}

export function convertActionCallsToPreDeltaCalls(calls: ActionCall[]): PreDeltaCall[] {
  return calls
    .filter((c) => c.callType === DeltaCallType.LENDING)
    .map((c) => {
      const { gasLimit, ...deltaCall } = c
      return deltaCall as PreDeltaCall
    })
}

export function convertActionCallsToPostDeltaCalls(calls: ActionCall[]): PostDeltaCall[] {
  const externalCallTypes = [
    DeltaCallType.DEFAULT,
    DeltaCallType.FULL_TOKEN_BALANCE,
    DeltaCallType.FULL_NATIVE_BALANCE,
    DeltaCallType.SWEEP_WITH_VALIDATION,
    DeltaCallType.APPROVE,
  ]
  return calls
    .filter((c) => externalCallTypes.includes(c.callType as DeltaCallType))
    .map((c) => {
      const { gasLimit, ...deltaCall } = c
      return deltaCall as PostDeltaCall
    })
}
