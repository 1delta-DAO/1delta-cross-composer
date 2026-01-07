import type { Address } from 'viem'
import type { GenericTrade } from '@1delta/lib-utils'
import { TradeType, DeltaCallType, LendingCall } from '@1delta/lib-utils'
import { fetchAllAggregatorTrades } from '../../lib/trade-helpers/aggregatorSelector'
import { fetchAllActionTrades } from '../trade-helpers/actionSelector'
import { DeltaCallConverter } from '../utils/deltaCallConverter'
import type { ActionCall } from '../../components/actions/shared/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'

export interface Quote {
  label: string
  trade: GenericTrade
}

export interface QuoteRequest {
  srcAmount: RawCurrencyAmount
  dstCurrency: RawCurrency
  slippage: number
  receiverAddress: Address
  destinationCalls?: ActionCall[]
  inputCalls?: ActionCall[]
}

export interface QuoteValidation {
  isValid: boolean
  isSameChain: boolean
  reason?: string
}

export function validateQuoteRequest(
  srcAmount?: RawCurrencyAmount,
  dstCurrency?: RawCurrency,
  inputCalls?: ActionCall[]
): QuoteValidation {
  const hasWithdrawMax = inputCalls?.some(
    (call) =>
      call?.callType === DeltaCallType.LENDING &&
      (call as any)?.lendingAction === LendingCall.DeltaCallLendingAction.WITHDRAW &&
      (call as any)?.amount === 0n
  )

  const amountOk = !!srcAmount && (srcAmount.amount > 0n || hasWithdrawMax)
  const srcCurrencyOk = Boolean(srcAmount?.currency)
  const dstCurrencyOk = Boolean(dstCurrency)

  if (!amountOk || !srcCurrencyOk || !dstCurrencyOk) {
    return {
      isValid: false,
      isSameChain: false,
      reason: !amountOk ? 'Invalid amount' : 'Missing currency',
    }
  }

  const isSameChain = srcAmount!.currency.chainId === dstCurrency!.chainId

  return {
    isValid: true,
    isSameChain,
  }
}

export function detectChainTransition(
  currentIsSameChain: boolean,
  previousIsSameChain: boolean | null
): boolean {
  return previousIsSameChain !== null && previousIsSameChain !== currentIsSameChain
}

export async function fetchQuotes(
  request: QuoteRequest,
  signal?: AbortSignal
): Promise<Quote[]> {
  const { srcAmount, dstCurrency, slippage, receiverAddress, destinationCalls, inputCalls } =
    request

  const srcCurrency = srcAmount.currency
  const srcChainId = srcCurrency.chainId
  const dstChainId = dstCurrency.chainId

  const rawAmount = srcAmount?.amount
  if (rawAmount === undefined || rawAmount === null) {
    throw new Error('Invalid quote input: missing amount')
  }

  const amountInWei = rawAmount.toString()
  const hasValidChainIds = Boolean(srcChainId && dstChainId)
  const isSameChain = hasValidChainIds && srcChainId === dstChainId

  if (!hasValidChainIds || !amountInWei) {
    throw new Error('Invalid quote input: missing chainId or amount')
  }

  const controller = new AbortController()
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  const preCalls =
    inputCalls && inputCalls.length > 0 ? DeltaCallConverter.toPreCalls(inputCalls) : undefined
  const postCalls =
    destinationCalls && destinationCalls.length > 0
      ? DeltaCallConverter.toPostCalls(destinationCalls)
      : undefined
  const destinationGasLimit =
    destinationCalls && destinationCalls.length > 0
      ? DeltaCallConverter.calculateGasLimit(destinationCalls)
      : undefined

  let allQuotes: Quote[] = []

  if (isSameChain) {
    const trades = await fetchAllAggregatorTrades(
      srcChainId,
      {
        chainId: srcChainId,
        fromCurrency: srcCurrency,
        toCurrency: dstCurrency,
        swapAmount: amountInWei,
        slippage,
        caller: receiverAddress,
        receiver: receiverAddress,
        tradeType: TradeType.EXACT_INPUT,
        flashSwap: false,
        usePermit: false,
      } as any,
      controller,
      preCalls,
      postCalls
    )
    allQuotes = trades.map((t) => ({ label: t.aggregator.toString(), trade: t.trade }))
  } else {
    const actionTrades = await fetchAllActionTrades(
      {
        slippage,
        tradeType: TradeType.EXACT_INPUT,
        fromCurrency: srcCurrency,
        toCurrency: dstCurrency,
        swapAmount: amountInWei,
        caller: receiverAddress,
        receiver: receiverAddress,
        order: 'CHEAPEST',
        usePermit: false,
        preCalls,
        postCalls,
        destinationGasLimit,
      } as any,
      controller
    )
    allQuotes = actionTrades.map((t) => ({ label: t.action, trade: t.trade }))
  }

  if (allQuotes.length === 0) {
    throw new Error('No quote available from any aggregator/bridge')
  }

  return allQuotes
}

export function sortQuotesByOutput(quotes: Quote[]): Quote[] {
  return [...quotes].sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
}

export function getBestQuote(quotes: Quote[]): Quote | undefined {
  if (quotes.length === 0) return undefined
  return sortQuotesByOutput(quotes)[0]
}

