import { toFunctionSelector, type Abi, type Address, type Hex } from "viem"
import type { DestinationActionConfig } from "../../../types/destinationAction"
import { SEQUENCE_MARKET_ABI, SEQUENCE_MARKET_ADDRESS, OLDERFALL_ARMORS_ADDRESS } from "../../../sequence/market"
import { SupportedChainId } from "@1delta/lib-utils"
import { generateOlderfallBuySteps } from "../../../sequence/marketplace"

const base: Omit<DestinationActionConfig, "functionSelectors" | "name" | "description" | "defaultFunctionSelector" | "address"> = {
  abi: SEQUENCE_MARKET_ABI as Abi,
  actionType: "game_token",
  group: "olderfall_nft",
}

function getAcceptRequestSelector(abi: Abi): Hex {
  const fn = (abi as any[]).find((x) => x?.type === "function" && x?.name === "acceptRequest")
  return toFunctionSelector(fn) as Hex
}

const ACCEPT_REQUEST_SELECTOR: Hex = getAcceptRequestSelector(SEQUENCE_MARKET_ABI as Abi)

const olderfallBuyConfig: DestinationActionConfig = {
  ...base,
  address: SEQUENCE_MARKET_ADDRESS,
  name: "Buy Olderfall Armor NFT",
  description: "Buy an Olderfall armor NFT via Sequence marketplace",
  functionSelectors: [ACCEPT_REQUEST_SELECTOR],
  defaultFunctionSelector: ACCEPT_REQUEST_SELECTOR,
  meta: {
    underlying: OLDERFALL_ARMORS_ADDRESS,
    symbol: "OLDERFALL_ARMOR",
    supportedChainIds: [SupportedChainId.POLYGON_MAINNET, SupportedChainId.MOONBEAM],
  },
  buildCalls: async (ctx) => {
    const meta = (olderfallBuyConfig.meta || {}) as any
    const chainId = ctx.dstChainId
    const buyer = ctx.userAddress
    const orderId = String(ctx.args?.[0] ?? "")
    const tokenId = String(meta.sequenceTokenId ?? "")

    if (!chainId || !buyer || !orderId || !tokenId) {
      return []
    }

    const steps = await generateOlderfallBuySteps({
      chainId,
      buyer,
      orderId,
      tokenId,
      quantity: "1",
    })

    return steps.map((step) => {
      const rawValue = step.value || ""
      const v = rawValue && rawValue !== "0" ? BigInt(rawValue) : 0n
      return {
        target: step.to as Address,
        calldata: step.data as Hex,
        value: v,
      }
    })
  },
}

export function getActions(opts?: { dstToken?: string; dstChainId?: string }): DestinationActionConfig[] {
  if (opts?.dstChainId && opts.dstChainId !== SupportedChainId.POLYGON_MAINNET) {
    return []
  }
  return [olderfallBuyConfig]
}
