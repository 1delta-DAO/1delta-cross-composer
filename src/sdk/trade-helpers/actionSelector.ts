import { fetchBridgeTradeWithoutComposed } from '@1delta/trade-sdk'
import { Bridge, getBridges } from '@1delta/bridge-configs'
import type { GenericTrade, RawCurrency } from '@1delta/lib-utils'
import type {
  AcrossBaseInput,
  AxelarBaseInput,
  BaseBridgeInput,
} from '@1delta/trade-sdk/dist/types'
import type { DeltaCall } from '@1delta/lib-utils'
import type { Address } from 'viem'
import { getCurrency as getCurrencyRaw } from '../../lib/trade-helpers/utils'
import { fetchAxelarTradeWithSwaps } from '@1delta/trade-sdk/dist/composedTrades/axelar/axelarWithSwaps'
import { fetchAcrossTradeWithSwaps } from '@1delta/trade-sdk/dist/composedTrades/across/acrossWithSwaps'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'
import type { useGeneralPricesCallbackType } from '@1delta/lib-utils/dist/types/priceQuery'

type ExtendedBridgeInput = BaseBridgeInput & {
  additionalCalls?: DeltaCall[]
}

function getCurrency(chainId: string | undefined, tokenAddress: string | undefined): RawCurrency {
  if (!chainId || !tokenAddress) {
    throw new Error('Invalid currency parameters')
  }
  const currency = getCurrencyRaw(chainId, tokenAddress as Address)
  if (!currency) {
    throw new Error(`Currency not found for ${chainId}:${tokenAddress}`)
  }
  return currency
}

function buildPricesCallbackFromRecord(prices?: PricesRecord): useGeneralPricesCallbackType {
  const record = prices || {}
  return (priceQueries) => {
    return priceQueries.map((q) => {
      if (!q.chainId || !q.asset) {
        return 0
      }
      const chainPrices = record[q.chainId]
      if (!chainPrices) {
        return 0
      }
      const assetLower = q.asset.toLowerCase()
      const priceObj = chainPrices[assetLower]
      if (!priceObj || !Number.isFinite(priceObj.usd) || priceObj.usd <= 0) {
        return 0
      }
      return priceObj.usd
    })
  }
}

export async function fetchAllActionTrades(
  input: ExtendedBridgeInput,
  controller?: AbortController,
  prices?: PricesRecord
): Promise<Array<{ action: string; trade: GenericTrade }>> {
  const availableBridges = getBridges()
  const hasAdditionalCalls = Boolean(input.additionalCalls && input.additionalCalls.length > 0)

  console.debug(
    'Fetching from actions:',
    availableBridges.map((b) => (b.toString ? b.toString() : String(b)))
  )
  if (availableBridges.length === 0) return []

  const results = await Promise.all(
    availableBridges.map(async (bridge: Bridge) => {
      try {
        let trade: GenericTrade | undefined

        if (hasAdditionalCalls) {
          if (bridge === Bridge.AXELAR) {
            const composedInput: AxelarBaseInput = {
              ...input,
              payFeeWithNative: true,
              additionalCalls: {
                calls: input.additionalCalls || [],
                gasLimit: input.destinationGasLimit,
              },
            }
            const pricesCallback = buildPricesCallbackFromRecord(prices)
            trade = await fetchAxelarTradeWithSwaps(
              composedInput,
              getCurrency,
              pricesCallback,
              controller
            )
          } else if (bridge === Bridge.ACROSS) {
            const composedInput: AcrossBaseInput = {
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

          trade = await fetchBridgeTradeWithoutComposed(
            bridge,
            baseInput,
            controller || new AbortController()
          )
        }

        if (trade) return { action: bridge.toString(), trade }
      } catch (error) {
        console.debug(`Error fetching trade from ${bridge}:`, {
          bridge,
          error,
          input,
        })
      }
      return undefined
    })
  )

  const trades = (results.filter(Boolean) as Array<{ action: string; trade: GenericTrade }>).filter(
    ({ trade }) => {
      const hasAssemble = typeof (trade as any)?.assemble === 'function'
      const tx = (trade as any)?.transaction
      const hasTx =
        Boolean(tx) && Boolean((tx as any).to) && Boolean((tx as any).calldata ?? (tx as any).data)
      return hasAssemble || hasTx
    }
  )

  return trades.sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
}
