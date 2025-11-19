import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { fetchEvmUserTokenDataEnhanced } from "../../sdk/utils/fetchBalances"

export type TokenBalance = { raw: string; value: string } | undefined

async function fetchTokenBalance(chainId: string, userAddress: Address, tokenAddress: Address): Promise<TokenBalance> {
  try {
    // If token is zero address, fetchEvmUserTokenDataEnhanced already includes it
    // If token is ERC20, we need to pass it in the assets array
    const assetsToFetch = tokenAddress.toLowerCase() === zeroAddress.toLowerCase() ? [] : [tokenAddress]
    const balanceData = await fetchEvmUserTokenDataEnhanced(chainId, userAddress, assetsToFetch)
    if (!balanceData) return undefined

    // Handle native token (zero address)
    if (tokenAddress.toLowerCase() === zeroAddress.toLowerCase()) {
      return {
        raw: balanceData.nativeBalance.balanceRaw,
        value: balanceData.nativeBalance.balance,
      }
    }

    // Handle ERC20 token
    const tokenInfo = balanceData.tokenData[tokenAddress.toLowerCase()]
    if (tokenInfo) {
      return {
        raw: tokenInfo.balanceRaw,
        value: tokenInfo.balance,
      }
    }

    return undefined
  } catch (e) {
    console.warn(`Failed to fetch balance for token ${tokenAddress} on chain ${chainId}:`, e)
    return undefined
  }
}

export function useTokenBalance(params: { chainId: string; userAddress?: Address; tokenAddress?: Address }) {
  const { chainId, userAddress, tokenAddress } = params
  return useQuery({
    queryKey: ["tokenBalance", chainId, userAddress ?? "0x", tokenAddress?.toLowerCase() ?? "0x"],
    enabled: Boolean(chainId && userAddress && tokenAddress),
    queryFn: () => fetchTokenBalance(chainId, userAddress as Address, tokenAddress as Address),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
  })
}
