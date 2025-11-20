import { fetchBridgeTradeWithoutComposed } from "@1delta/trade-sdk"
import { Bridge, getBridges } from "@1delta/bridge-configs"
import type { GenericTrade, RawCurrency } from "@1delta/lib-utils"
import type { BaseBridgeInput, BaseComposedInput } from "@1delta/trade-sdk/dist/types"
import type { Address } from "viem"
import { getPricesCallback } from "../../lib/trade-helpers/prices"
import { getCurrency as getCurrencyRaw } from "../../lib/trade-helpers/utils"
import { fetchAxelarTradeWithSwaps } from "@1delta/trade-sdk/dist/composedTrades/axelar/axelarWithSwaps"
import { fetchAcrossTradeWithSwaps } from "@1delta/trade-sdk/dist/composedTrades/across/acrossWithSwaps"

type ExtendedBridgeInput = BaseComposedInput & BaseBridgeInput

function getCurrency(chainId: string | undefined, tokenAddress: string | undefined): RawCurrency {
  if (!chainId || !tokenAddress) {
    throw new Error("Invalid currency parameters")
  }
  const currency = getCurrencyRaw(chainId, tokenAddress as Address)
  if (!currency) {
    throw new Error(`Currency not found for ${chainId}:${tokenAddress}`)
  }
  return currency
}

export async function fetchAllBridgeTrades(
  input: ExtendedBridgeInput,
  controller?: AbortController,
): Promise<Array<{ bridge: string; trade: GenericTrade }>> {
  const availableBridges = getBridges()
  const hasAdditionalCalls = Boolean(input.additionalCalls && input.additionalCalls.length > 0)

  console.debug(
    "Fetching from bridges:",
    availableBridges.map((b) => (b.toString ? b.toString() : String(b))),
  )
  if (availableBridges.length === 0) return []

  const results = await Promise.all(
    availableBridges.map(async (bridge: Bridge) => {
      try {
        let trade: GenericTrade | undefined

        if (hasAdditionalCalls) {
          if (bridge === Bridge.AXELAR || bridge === Bridge.ACROSS) {
            const composedInput = {
              ...input,
              additionalCalls: input.additionalCalls || [],
            } as BaseComposedInput

            if (bridge === Bridge.AXELAR) {
              trade = await fetchAxelarTradeWithSwaps(composedInput, getCurrency, getPricesCallback, controller)
            } else {
              trade = await fetchAcrossTradeWithSwaps(composedInput, getCurrency, controller)
            }
          } else {
            return undefined
          }
        } else {
          const baseInput: BaseBridgeInput = {
            ...input,
          }

          trade = await fetchBridgeTradeWithoutComposed(bridge, baseInput, controller || new AbortController())
        }

        if (trade) return { bridge: bridge.toString(), trade }
      } catch (error) {
        console.debug("Error fetching trade from ${bridge}:", {
          bridge,
          error,
          input,
        })
      }
      return undefined
    }),
  )

  const trades = (results.filter(Boolean) as Array<{ bridge: string; trade: GenericTrade }>).filter(({ trade }) => {
    const hasAssemble = typeof (trade as any)?.assemble === "function"
    const hasTx = Boolean((trade as any)?.transaction)
    return hasAssemble || hasTx
  })

  return trades.sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
}
