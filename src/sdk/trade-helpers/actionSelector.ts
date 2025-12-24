import { fetchBridgeTradeWithoutComposed } from '@1delta/trade-sdk'
import { Bridge, getBridges } from '@1delta/bridge-configs'
import type { GenericTrade, PreDeltaCall, PostDeltaCall } from '@1delta/lib-utils'
import type {
  AcrossBaseInput,
  AxelarBaseInput,
  BaseBridgeInput,
} from '@1delta/trade-sdk/dist/types'
import { fetchAxelarTradeWithSwaps } from '@1delta/trade-sdk/dist/composedTrades/axelar/axelarWithSwaps'
import { fetchAcrossTradeWithSwaps } from '@1delta/trade-sdk/dist/composedTrades/across/acrossWithSwaps'

type ExtendedBridgeInput = BaseBridgeInput & {
  preCalls?: PreDeltaCall[]
  postCalls?: PostDeltaCall[]
  destinationGasLimit?: bigint
}

export async function fetchAllActionTrades(
  input: ExtendedBridgeInput,
  controller?: AbortController
): Promise<Array<{ action: string; trade: GenericTrade }>> {
  const availableBridges = getBridges()
  const hasPreCalls = Boolean(input.preCalls && input.preCalls.length > 0)
  const hasPostCalls = Boolean(input.postCalls && input.postCalls.length > 0)
  const hasAdditionalCalls = hasPreCalls || hasPostCalls

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
            const { postCalls: _, preCalls: __, ...baseInput } = input
            const composedInput: AxelarBaseInput = {
              ...baseInput,
              payFeeWithNative: true,
              ...(hasPostCalls && input.postCalls
                ? {
                    postCalls: {
                      calls: input.postCalls,
                      gasLimit: input.destinationGasLimit,
                    },
                  }
                : undefined),
              ...(hasPreCalls && input.preCalls ? { preCalls: input.preCalls } : undefined),
            }
            trade = await fetchAxelarTradeWithSwaps(composedInput, controller)
          } else if (bridge === Bridge.ACROSS) {
            const composedInput: AcrossBaseInput = {
              ...input,
              ...(hasPostCalls ? { postCalls: input.postCalls || [] } : {}),
              ...(hasPreCalls ? { preCalls: input.preCalls || [] } : {}),
            }
            trade = await fetchAcrossTradeWithSwaps(composedInput, controller)
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
