import { type Address, zeroAddress } from 'viem'
import { getTokenFromCache } from '../data/tokenListsCache'
import type { RawCurrency } from '../../types/currency'
import { chains } from '@1delta/data-sdk'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import type { ActionCall } from '../../components/actions/shared/types'
import type { DeltaCall } from '@1delta/lib-utils'

export function getCurrency(
  chainId: string,
  tokenAddress: Address | undefined
): RawCurrency | undefined {
  if (!tokenAddress || !chainId) {
    return undefined
  }

  if (tokenAddress.toLowerCase() === zeroAddress.toLowerCase()) {
    const chainInfo = chains()?.[chainId]
    if (!chainInfo?.nativeCurrency) return undefined
    const { symbol, name, decimals } = chainInfo.nativeCurrency
    return CurrencyHandler.Currency(chainId, zeroAddress, decimals, symbol, name)
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
