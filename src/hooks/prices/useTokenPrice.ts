import type { Address } from "viem"
import { useDexscreenerPrices } from "./useDexscreenerPrices"

export function useTokenPrice(params: { chainId: string; tokenAddress?: Address; enabled?: boolean }) {
  const { chainId, tokenAddress, enabled = true } = params

  const { data, isLoading, ...rest } = useDexscreenerPrices({
    chainId,
    addresses: tokenAddress ? [tokenAddress] : [],
    enabled: enabled && Boolean(chainId && tokenAddress),
  })

  const price = tokenAddress && data?.[chainId]?.[tokenAddress.toLowerCase()]?.usd

  return {
    price,
    isLoading,
    ...rest,
  }
}
