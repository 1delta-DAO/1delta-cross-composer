import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { fetchEvmUserTokenDataEnhanced } from "../../sdk/utils/fetchBalances"

export type ChainBalancesRecord = Record<string, Record<string, { raw: string; value: string }>>

async function fetchBalances(chainId: string, userAddress: Address, tokenAddresses: Address[]): Promise<ChainBalancesRecord> {
  const result: Record<string, { raw: string; value: string }> = {}
  if (tokenAddresses.length === 0) return { [chainId]: result }

  try {
    const balanceData = await fetchEvmUserTokenDataEnhanced(chainId, userAddress, tokenAddresses)
    if (!balanceData) return { [chainId]: result }

    // Add native balance (zero address)
    result[zeroAddress] = {
      raw: balanceData.nativeBalance.balanceRaw,
      value: balanceData.nativeBalance.balance,
    }

    // Add token balances
    for (const [address, tokenInfo] of Object.entries(balanceData.tokenData)) {
      result[address.toLowerCase()] = {
        raw: tokenInfo.balanceRaw,
        value: tokenInfo.balance,
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch balances for chain ${chainId}:`, e)
  }

  return { [chainId]: result }
}

export function useEvmBalances(params: { chainId: string; userAddress?: Address; tokenAddresses: Address[] }) {
  const { chainId, userAddress, tokenAddresses } = params
  return useQuery({
    queryKey: [
      "balances",
      chainId,
      userAddress ?? "0x",
      tokenAddresses
        .map((a) => a.toLowerCase())
        .sort()
        .join(","),
    ],
    enabled: Boolean(chainId && userAddress && tokenAddresses && tokenAddresses.length > 0),
    queryFn: () => fetchBalances(chainId, userAddress as Address, tokenAddresses),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
  })
}
