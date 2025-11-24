import { fetchBridgeTradeWithoutComposed } from "@1delta/trade-sdk"
import { Bridge, getBridges } from "@1delta/bridge-configs"
import type { GenericTrade, RawCurrency } from "@1delta/lib-utils"
import type { BaseBridgeInput, BaseComposedInput, BaseComposedWithGasLimitInput } from "@1delta/trade-sdk/dist/types"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { getPricesCallback } from "../../lib/trade-helpers/prices"
import { getCurrency as getCurrencyRaw } from "../../lib/trade-helpers/utils"
import { fetchAxelarTradeWithSwaps } from "@1delta/trade-sdk/dist/composedTrades/axelar/axelarWithSwaps"
import { fetchAcrossTradeWithSwaps } from "@1delta/trade-sdk/dist/composedTrades/across/acrossWithSwaps"
import { fetchPrices } from "../../hooks/prices/useDexscreenerPrices"
import { setPricesFromDexscreener } from "../../lib/trade-helpers/prices"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"

type ExtendedBridgeInput = BaseBridgeInput & { additionalCalls?: BaseComposedInput["additionalCalls"] }

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

async function fetchPricesForCurrencies(currencies: RawCurrency[]): Promise<void> {
  const addressesByChain: Record<string, Set<string>> = {}

  for (const currency of currencies) {
    if (!currency?.chainId || !currency?.address) continue

    const chainId = currency.chainId
    const addr = currency.address.toLowerCase()
    const resolvedAddr =
      addr === zeroAddress.toLowerCase()
        ? CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)?.toLowerCase() || addr
        : addr

    if (!addressesByChain[chainId]) {
      addressesByChain[chainId] = new Set()
    }
    addressesByChain[chainId].add(resolvedAddr)

    const nativeWrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
    if (nativeWrapped && nativeWrapped.toLowerCase() !== resolvedAddr.toLowerCase()) {
      addressesByChain[chainId].add(nativeWrapped.toLowerCase())
    }
  }

  const priceFetches = Object.entries(addressesByChain).map(([chainId, addresses]) => {
    const addressArray = Array.from(addresses) as Address[]
    return fetchPrices(chainId, addressArray)
      .then((prices) => {
        setPricesFromDexscreener(prices)
      })
      .catch(() => {})
  })

  await Promise.all(priceFetches)
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
          if (bridge === Bridge.AXELAR) {
            await fetchPricesForCurrencies([input.fromCurrency, input.toCurrency].filter(Boolean) as RawCurrency[])
            
            const composedInput: BaseComposedWithGasLimitInput = {
              ...input,
              additionalCalls: {
                calls: input.additionalCalls || [],
                gasLimit: input.destinationGasLimit,
              },
            }
            trade = await fetchAxelarTradeWithSwaps(composedInput, getCurrency, getPricesCallback, controller)
          } else if (bridge === Bridge.ACROSS) {
            const composedInput: BaseComposedInput = {
              ...input,
              additionalCalls: input.additionalCalls || [],
            }
            trade = await fetchAcrossTradeWithSwaps(composedInput, getCurrency, controller)
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
