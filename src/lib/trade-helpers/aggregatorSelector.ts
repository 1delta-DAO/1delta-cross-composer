import { fetchAggregatorTrade, getAvailableAggregators, TradeAggregator } from '@1delta/trade-sdk'
import type { GenericTrade, AggregatorApiInput, DeltaCall } from '@1delta/lib-utils'

export async function fetchAllAggregatorTrades(
  chainId: string,
  input: AggregatorApiInput,
  controller?: AbortController,
  additionalCalls?: DeltaCall[]
): Promise<Array<{ aggregator: string; trade: GenericTrade }>> {
  const availableAggregators = getAvailableAggregators(chainId)
  if (availableAggregators.length === 0) return []

  const inputWithCalls: AggregatorApiInput = additionalCalls
    ? { ...input, additionalCalls, disableComposer: false }
    : input

  const results = await Promise.all(
    availableAggregators.map(async (aggregatorName: string) => {
      try {
        const aggregator = aggregatorName as TradeAggregator
        const trade = await fetchAggregatorTrade(aggregator, inputWithCalls, controller)
        if (trade) return { aggregator: aggregatorName, trade }
      } catch {}
      return undefined
    })
  )

  const trades = results.filter(Boolean) as Array<{ aggregator: string; trade: GenericTrade }>

  return trades.sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
}
