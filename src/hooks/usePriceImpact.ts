import { useMemo } from "react"
import type { Address } from "viem"
import type { GenericTrade } from "../sdk/types"
import { getTokenPrice } from "../components/swap/swapUtils"

export function usePriceImpact({
  selectedTrade,
  amount,
  quoteOut,
  srcToken,
  dstToken,
  srcChainId,
  dstChainId,
  srcPricesMerged,
  dstPricesMerged,
}: {
  selectedTrade?: GenericTrade
  amount: string
  quoteOut?: string
  srcToken?: Address
  dstToken?: Address
  srcChainId?: string
  dstChainId?: string
  srcPricesMerged?: Record<string, { usd: number }>
  dstPricesMerged?: Record<string, { usd: number }>
}): number | undefined {
  return useMemo(() => {
    if (!selectedTrade || !amount || !quoteOut || !srcToken || !dstToken || !srcChainId || !dstChainId) {
      return undefined
    }
    try {
      // Get token prices
      const srcPrice = getTokenPrice(srcChainId, srcToken, srcPricesMerged)
      const dstPrice = getTokenPrice(dstChainId, dstToken, dstPricesMerged)

      if (!srcPrice || !dstPrice) return undefined

      // Calculate expected output based on spot price
      const inputValue = Number(amount) * srcPrice
      const expectedOutput = inputValue / dstPrice

      // Actual output from trade
      const actualOutput = Number(quoteOut)

      if (expectedOutput <= 0 || actualOutput <= 0) return undefined

      // Price impact = (expected - actual) / expected * 100
      const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100
      return Math.max(0, impact) // Ensure non-negative
    } catch {
      return undefined
    }
  }, [selectedTrade, amount, quoteOut, srcToken, dstToken, srcChainId, dstChainId, srcPricesMerged, dstPricesMerged])
}
