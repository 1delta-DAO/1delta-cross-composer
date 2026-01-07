import { fetchAggregatorTrade, getAvailableAggregators, TradeAggregator } from '@1delta/trade-sdk'
import type {
  GenericTrade,
  AggregatorApiInput,
  PreDeltaCall,
  PostDeltaCall,
} from '@1delta/lib-utils'

export async function fetchAllAggregatorTrades(
  chainId: string,
  input: AggregatorApiInput,
  controller?: AbortController,
  preCalls?: PreDeltaCall[],
  postCalls?: PostDeltaCall[]
): Promise<Array<{ aggregator: string; trade: GenericTrade }>> {
  const availableAggregators = getAvailableAggregators(chainId)
  if (availableAggregators.length === 0) return []

  const inputWithCalls: AggregatorApiInput = {
    ...input,
    ...(preCalls && preCalls.length > 0 ? { preCalls } : {}),
    ...(postCalls && postCalls.length > 0 ? { postCalls } : {}),
    disableComposer: false,
  }

  const results = await Promise.all(
    availableAggregators.map(async (aggregatorName: string) => {
      try {
        const aggregator = aggregatorName as TradeAggregator
        const trade = await fetchAggregatorTrade(aggregator, inputWithCalls, controller)
        if (trade) return { aggregator: aggregatorName, trade }
      } catch (error) {
        console.debug(`Error fetching trade from ${aggregatorName}:`, error)
      }
      return undefined
    })
  )

  const trades = results.filter(Boolean) as Array<{ aggregator: string; trade: GenericTrade }>

  return trades.sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
}
