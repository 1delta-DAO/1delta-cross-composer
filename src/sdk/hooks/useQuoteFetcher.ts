import type { Address } from 'viem'
import type { DeltaCall, GenericTrade } from '@1delta/lib-utils'
import { TradeType } from '@1delta/lib-utils'
import { convertActionCallsToDeltaCalls } from '../../lib/trade-helpers/utils'
import { fetchAllAggregatorTrades } from '../../lib/trade-helpers/aggregatorSelector'
import { fetchAllActionTrades } from '../trade-helpers/actionSelector'
import type { ActionCall } from '../../components/actions/shared/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'

export type Quote = { label: string; trade: GenericTrade }

export interface QuoteFetcherParams {
  srcAmount: RawCurrencyAmount
  dstCurrency: RawCurrency
  slippage: number
  receiverAddress: Address
  destinationCalls?: ActionCall[]
  controller: AbortController
  axelarPrices?: PricesRecord
}

export async function fetchQuotes(params: QuoteFetcherParams): Promise<Quote[]> {
  const {
    srcAmount,
    dstCurrency,
    slippage,
    receiverAddress,
    destinationCalls,
    controller,
    axelarPrices,
  } = params

  const srcCurrency = srcAmount.currency
  const srcChainId = srcCurrency.chainId
  const dstChainId = dstCurrency.chainId

  const rawAmount = (srcAmount as any)?.amount
  if (rawAmount === undefined || rawAmount === null) {
    console.warn('Invalid quote input: missing srcAmount.amount', {
      srcCurrency,
      dstCurrency,
      srcAmount,
    })
    throw new Error('Invalid quote input: missing amount')
  }

  const amountInWei = rawAmount.toString()
  const hasValidChainIds = Boolean(srcChainId && dstChainId)
  const isSameChain = hasValidChainIds && srcChainId === dstChainId

  if (!hasValidChainIds || !amountInWei) {
    console.warn('Invalid quote input detected', {
      srcChainId,
      dstChainId,
      amountInWei,
      srcCurrencySymbol: srcCurrency.symbol,
      dstCurrencySymbol: dstCurrency.symbol,
    })
    throw new Error('Invalid quote input: missing chainId or amount')
  }

  console.debug('Fetching quote:', {
    isSameChain,
    chainId: srcChainId,
    fromCurrency: srcCurrency.symbol,
    toCurrency: dstCurrency.symbol,
    amountInWei,
    slippage,
  })

  let allQuotes: Quote[] = []

  let additionalCalls: DeltaCall[] | undefined
  let destinationGasLimit: bigint | undefined
  if (destinationCalls && destinationCalls.length > 0) {
    additionalCalls = convertActionCallsToDeltaCalls(destinationCalls)
    destinationGasLimit = destinationCalls.reduce((acc, c) => acc + (c.gasLimit || 0n), 0n)
  }

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
      additionalCalls
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
        ...(additionalCalls ? { additionalCalls } : {}),
        destinationGasLimit,
      } as any,
      controller,
      (axelarPrices || {}) as PricesRecord
    )
    console.log('All actions received from trade-sdk:', {
      actions: actionTrades.map((t) => t.action),
      actionTrades,
    })
    allQuotes = actionTrades.map((t) => ({ label: t.action, trade: t.trade }))
  }

  if (allQuotes.length === 0) {
    throw new Error('No quote available from any aggregator/bridge')
  }

  return allQuotes
}
