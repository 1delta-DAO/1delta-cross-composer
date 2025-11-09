import { fetchAggregatorTrade, getAvailableAggregators, TradeAggregator } from "@1delta/trade-sdk"
import type { GenericTrade } from "@1delta/lib-utils"
import type { AggregatorApiInput } from "@1delta/lib-utils"

const AGGREGATOR_TIMEOUT_MS = 2000 // 2 seconds timeout for aggregator quotes

// Priority aggregators - these will be preferred if they return quotes
const PRIORITY_AGGREGATORS = ["Odos", "Kyberswap"]

/**
 * Fetch the best aggregator trade by trying all available aggregators
 * Returns the trade with the highest output amount, prioritizing certain aggregators
 */
export async function fetchBestAggregatorTrade(
    chainId: string,
    input: AggregatorApiInput,
    controller?: AbortController
): Promise<GenericTrade | undefined> {
    const availableAggregators = getAvailableAggregators(chainId)

    if (availableAggregators.length === 0) {
        throw new Error("No aggregators available for this chain")
    }

    const trades: Array<{ trade: GenericTrade; aggregator: string | number }> = []
    let timeout: NodeJS.Timeout | undefined

    const collectionPromise = new Promise<void>((resolve) => {
        let settledCount = 0
        let isDone = false

        const done = () => {
            if (!isDone) {
                isDone = true
                if (timeout) clearTimeout(timeout)
                resolve()
            }
        }

        // Check if already aborted
        if (controller?.signal.aborted) {
            return done()
        }

        // Set timeout
        timeout = setTimeout(() => {
            console.debug(`Aggregator timeout after ${AGGREGATOR_TIMEOUT_MS}ms, found ${trades.length} trades`)
            done()
        }, AGGREGATOR_TIMEOUT_MS)

        // Fetch from all aggregators in parallel
        availableAggregators.forEach((aggregatorName: string) => {
            if (controller?.signal.aborted) {
                settledCount++
                if (settledCount === availableAggregators.length) {
                    done()
                }
                return
            }

            const aggregator = aggregatorName as TradeAggregator
            fetchAggregatorTrade(aggregator, input, controller)
                .then((trade) => {
                    if (controller?.signal.aborted) return

                    if (trade) {
                        trades.push({ trade, aggregator: aggregatorName })
                        console.debug(`Got trade from ${aggregatorName}, output: ${trade.outputAmountRealized}`)
                    }
                })
                .catch((error) => {
                    if (controller?.signal.aborted) return
                    console.debug(`Error fetching trade from ${aggregator}:`, error)
                })
                .finally(() => {
                    settledCount++
                    if (settledCount === availableAggregators.length) {
                        done()
                    }
                })
        })
    })

    await collectionPromise

    if (controller?.signal.aborted) {
        return undefined
    }

    if (trades.length === 0) {
        console.debug("No trades found from any aggregator")
        return undefined
    }

    // Check priority aggregators first
    for (const priorityAgg of PRIORITY_AGGREGATORS) {
        const priorityTrade = trades.find((t) => t.aggregator === priorityAgg)
        if (priorityTrade) {
            console.debug(`Using prioritized aggregator: ${priorityAgg}`)
            return priorityTrade.trade
        }
    }

    // Otherwise, return the trade with the highest output amount
    const bestTrade = trades.reduce((best, current) => {
        const bestOutput = best.trade.outputAmountRealized ?? 0
        const currentOutput = current.trade.outputAmountRealized ?? 0
        return currentOutput > bestOutput ? current : best
    })

    console.debug(`Using best aggregator: ${bestTrade.aggregator} with output: ${bestTrade.trade.outputAmountRealized}`)
    return bestTrade.trade
}

/**
 * Fetch all aggregator trades (successful only), returns sorted descending by outputAmountRealized
 */
export async function fetchAllAggregatorTrades(
    chainId: string,
    input: AggregatorApiInput,
    controller?: AbortController
): Promise<Array<{ aggregator: string; trade: GenericTrade }>> {
    const availableAggregators = getAvailableAggregators(chainId)
    if (availableAggregators.length === 0) return []

    const results = await Promise.all(
        availableAggregators.map(async (aggregatorName: string) => {
            try {
                const aggregator = aggregatorName as TradeAggregator
                const trade = await fetchAggregatorTrade(aggregator, input, controller)
                if (trade) return { aggregator: aggregatorName, trade }
            } catch {}
            return undefined
        })
    )

    const trades = results.filter(Boolean) as Array<{ aggregator: string; trade: GenericTrade }>

    // Priority first, then by highest output
    const priorityIndex = (name: string) => {
        const idx = PRIORITY_AGGREGATORS.indexOf(name)
        return idx === -1 ? Number.POSITIVE_INFINITY : idx
    }

    return trades
        .sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
        .sort((a, b) => priorityIndex(a.aggregator) - priorityIndex(b.aggregator))
}
