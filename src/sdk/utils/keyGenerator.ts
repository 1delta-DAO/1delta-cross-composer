import type { Address } from 'viem'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import type { ActionCall } from '../../components/actions/shared/types'

export function hashActionCall(call: ActionCall): string {
  const target = 'target' in call && call.target ? call.target.toLowerCase() : ''
  const value = 'value' in call && call.value ? call.value.toString() : ''
  const callDataStart = 'callData' in call && call.callData ? call.callData.slice(0, 10) : ''
  const callDataEnd = 'callData' in call && call.callData ? call.callData.slice(-10) : ''
  const gasLimit = call.gasLimit ? call.gasLimit.toString() : ''
  const callType = typeof call.callType === 'number' ? call.callType : 0
  const tokenAddress =
    'tokenAddress' in call && call.tokenAddress ? call.tokenAddress.toLowerCase() : ''
  const balanceOfInjectIndex =
    'balanceOfInjectIndex' in call && typeof call.balanceOfInjectIndex === 'number'
      ? call.balanceOfInjectIndex
      : 0
  const lendingAction = 'lendingAction' in call ? (call.lendingAction as number) : 0
  const lender = 'lender' in call ? String(call.lender) : ''

  return `${target}:${value}:${callDataStart}${callDataEnd}:${gasLimit}:${callType}:${tokenAddress}:${balanceOfInjectIndex}:${lendingAction}:${lender}`
}

export function hashActionCalls(calls?: ActionCall[]): string {
  if (!calls || calls.length === 0) return ''
  return calls.map(hashActionCall).join('|')
}

export function createCurrencyKey(currency?: RawCurrency): string {
  if (!currency) return ''
  return `${currency.chainId}:${currency.address.toLowerCase()}`
}

export function createCurrencyAmountKey(amount?: RawCurrencyAmount): string {
  if (!amount) return ''
  return `${createCurrencyKey(amount.currency)}:${amount.amount.toString()}`
}

export interface QuoteKeyParams {
  srcAmount?: RawCurrencyAmount
  dstCurrency?: RawCurrency
  slippage: number
  receiverAddress: Address | string
  destinationCalls?: ActionCall[]
  inputCalls?: ActionCall[]
}

export function createQuoteKey(params: QuoteKeyParams): string {
  const srcKey = createCurrencyAmountKey(params.srcAmount)
  const dstKey = createCurrencyKey(params.dstCurrency)
  const receiver = params.receiverAddress?.toString().toLowerCase() || ''
  const postCalls = hashActionCalls(params.destinationCalls)
  const preCalls = hashActionCalls(params.inputCalls)

  return `${srcKey}|${dstKey}|${params.slippage}|${receiver}|${postCalls}|${preCalls}`
}

export function areKeysEqual(key1: string | null | undefined, key2: string | null | undefined): boolean {
  return key1 != null && key2 != null && key1 === key2
}

export function createBalanceQueryKey(
  currencies: RawCurrency[],
  userAddress?: string
): (string | undefined)[] {
  const keys: Set<string> = new Set()
  for (const currency of currencies) {
    if (currency?.chainId && currency?.address) {
      keys.add(createCurrencyKey(currency))
    }
  }
  return ['balances', userAddress, ...Array.from(keys).sort()]
}

export function createPriceQueryKey(currencies: RawCurrency[]): string[] {
  const perCurrencyKeys: string[] = []
  for (const currency of currencies) {
    if (!currency?.chainId || !currency?.address) continue
    const baseKey = currency.assetGroup ? String(currency.assetGroup) : currency.address.toLowerCase()
    perCurrencyKeys.push(`${currency.chainId}:${baseKey}`)
  }
  perCurrencyKeys.sort()
  return ['prices', ...perCurrencyKeys]
}

