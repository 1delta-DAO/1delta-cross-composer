import type { ActionCall } from '../../../components/actions/shared/types'
import type { Address } from 'viem'
import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'

export function generateDestinationCallsKey(destinationCalls?: ActionCall[]): string {
  return JSON.stringify(
    (destinationCalls || []).map((c) => ({
      t: 'target' in c && c.target ? c.target.toLowerCase() : '',
      v: 'value' in c && c.value ? c.value.toString() : '',
      dStart: 'callData' in c && c.callData ? c.callData.slice(0, 10) : '',
      dEnd: 'callData' in c && c.callData ? c.callData.slice(-10) : '',
      g: c.gasLimit ? c.gasLimit.toString() : '',
      ct: typeof c.callType === 'number' ? c.callType : 0,
      ta: 'tokenAddress' in c && c.tokenAddress ? c.tokenAddress.toLowerCase() : '',
      bi:
        'balanceOfInjectIndex' in c && typeof c.balanceOfInjectIndex === 'number'
          ? c.balanceOfInjectIndex
          : 0,
    }))
  )
}

export function generateCurrencyKey(currency?: RawCurrency): string {
  if (!currency) return ''
  return `${currency.chainId}|${currency.address.toLowerCase()}`
}

export function generateQuoteKey(
  srcAmount: RawCurrencyAmount | undefined,
  dstCurrency: RawCurrency | undefined,
  slippage: number,
  receiverAddress: Address | string,
  destinationCallsKey: string
): string {
  const srcKey = srcAmount ? generateCurrencyKey(srcAmount.currency) : ''
  const dstKey = dstCurrency ? generateCurrencyKey(dstCurrency) : ''
  const amount = srcAmount ? srcAmount.amount.toString() : ''
  return `${amount}|${srcKey}|${dstKey}|${slippage}|${receiverAddress}|${destinationCallsKey}`
}

export function areQuoteKeysEqual(key1: string | null, key2: string | null): boolean {
  return key1 !== null && key2 !== null && key1 === key2
}
