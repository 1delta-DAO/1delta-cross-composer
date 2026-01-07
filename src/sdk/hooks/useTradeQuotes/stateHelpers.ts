import {
  hashActionCalls,
  createCurrencyKey,
  createQuoteKey as createQuoteKeyNew,
  areKeysEqual,
  type QuoteKeyParams,
} from '../../utils/keyGenerator'
import type { ActionCall } from '../../../components/actions/shared/types'
import type { Address } from 'viem'
import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'

/** @deprecated Use hashActionCalls from sdk/utils/keyGenerator instead */
export function generateDestinationCallsKey(destinationCalls?: ActionCall[]): string {
  return hashActionCalls(destinationCalls)
}

/** @deprecated Use hashActionCalls from sdk/utils/keyGenerator instead */
export function generateInputCallsKey(inputCalls?: ActionCall[]): string {
  return hashActionCalls(inputCalls)
}

/** @deprecated Use createCurrencyKey from sdk/utils/keyGenerator instead */
export function generateCurrencyKey(currency?: RawCurrency): string {
  return createCurrencyKey(currency)
}

/** @deprecated Use createQuoteKey from sdk/utils/keyGenerator instead */
export function generateQuoteKey(
  srcAmount: RawCurrencyAmount | undefined,
  dstCurrency: RawCurrency | undefined,
  slippage: number,
  receiverAddress: Address | string,
  destinationCallsKey: string,
  inputCallsKey?: string
): string {
  return createQuoteKeyNew({
    srcAmount,
    dstCurrency,
    slippage,
    receiverAddress,
  })
}

/** @deprecated Use areKeysEqual from sdk/utils/keyGenerator instead */
export function areQuoteKeysEqual(key1: string | null, key2: string | null): boolean {
  return areKeysEqual(key1, key2)
}
