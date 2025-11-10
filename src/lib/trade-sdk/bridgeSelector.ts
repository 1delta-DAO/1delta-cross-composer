import { fetchBridgeTradeWithoutComposed as fetchBridgeTrade } from "@1delta/trade-sdk"
import { Bridge, getBridges } from "@1delta/bridge-configs"
import type { GenericTrade } from "@1delta/lib-utils"
import type { BaseBridgeInput } from "@1delta/trade-sdk/dist/types"

const BRIDGE_TIMEOUT_MS = 5000

const PRIORITY_BRIDGES = [Bridge.AXELAR, Bridge.SQUID_V2, Bridge.LIFI]

export async function fetchBestBridgeTrade(input: BaseBridgeInput, controller?: AbortController): Promise<GenericTrade | undefined> {
    const availableBridges = getBridges()

    if (availableBridges.length === 0) {
        throw new Error("No bridges available")
    }

    const trades: Array<{ trade: GenericTrade; bridge: Bridge }> = []
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

        if (controller?.signal.aborted) {
            return done()
        }

        timeout = setTimeout(() => {
            console.debug(`Bridge timeout after ${BRIDGE_TIMEOUT_MS}ms, found ${trades.length} trades`)
            done()
        }, BRIDGE_TIMEOUT_MS)

        availableBridges.forEach((bridge: Bridge) => {
            if (controller?.signal.aborted) {
                settledCount++
                if (settledCount === availableBridges.length) {
                    done()
                }
                return
            }

            fetchBridgeTrade(bridge, input, controller)
                .then((trade) => {
                    if (controller?.signal.aborted) return

                    if (trade) {
                        trades.push({ trade, bridge })
                        console.debug(`Got trade from ${bridge}, output: ${trade.outputAmountRealized}`)
                    }
                })
                .catch((error) => {
                    if (controller?.signal.aborted) return
                    console.debug(`Error fetching trade from ${bridge}:`, error)
                })
                .finally(() => {
                    settledCount++
                    if (settledCount === availableBridges.length) {
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
        console.debug("No trades found from any bridge")
        return undefined
    }

    for (const priorityBridge of PRIORITY_BRIDGES) {
        const priorityTrade = trades.find((t) => t.bridge === priorityBridge)
        if (priorityTrade) {
            console.debug(`Using prioritized bridge: ${priorityBridge}`)
            return priorityTrade.trade
        }
    }

    const bestTrade = trades.reduce((best, current) => {
        const bestOutput = best.trade.outputAmountRealized ?? 0
        const currentOutput = current.trade.outputAmountRealized ?? 0
        return currentOutput > bestOutput ? current : best
    })

    console.debug(`Using best bridge: ${bestTrade.bridge} with output: ${bestTrade.trade.outputAmountRealized}`)
    return bestTrade.trade
}

export async function fetchAllBridgeTrades(
    input: BaseBridgeInput,
    controller?: AbortController
): Promise<Array<{ bridge: string; trade: GenericTrade }>> {
    const availableBridges = getBridges()
    if (availableBridges.length === 0) return []

    const results = await Promise.all(
        availableBridges.map(async (bridge: Bridge) => {
            try {
                const trade = await fetchBridgeTrade(bridge, input, controller)
                if (trade) return { bridge: bridge.toString(), trade }
            } catch {}
            return undefined
        })
    )

    const trades = results.filter(Boolean) as Array<{ bridge: string; trade: GenericTrade }>

    const priorityIndex = (name: string) => {
        const idx = PRIORITY_BRIDGES.indexOf(name as Bridge)
        return idx === -1 ? Number.POSITIVE_INFINITY : idx
    }

    return trades
        .sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
        .sort((a, b) => priorityIndex(a.bridge) - priorityIndex(b.bridge))
}
