import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { readContract } from "viem/actions"
import { getRpcSelectorEvmClient, SupportedChainId } from "@1delta/lib-utils"
import { MTOKEN_ABI } from "../../lib/actions/lending/moonwell/mTokenAbi"

export type BorrowBalance = { raw: string; value: string } | undefined

async function fetchBorrowBalance(chainId: string, userAddress: Address, mTokenAddress: Address): Promise<BorrowBalance> {
  try {
    const client = await getRpcSelectorEvmClient(chainId)
    if (!client) return undefined

    const balance = await readContract(client, {
      address: mTokenAddress,
      abi: MTOKEN_ABI,
      functionName: "borrowBalanceStored",
      args: [userAddress],
    })

    const balanceBigInt = BigInt(balance.toString())
    if (balanceBigInt === 0n) return undefined

    return {
      raw: balanceBigInt.toString(),
      value: balanceBigInt.toString(), // We'll format it in the component with decimals
    }
  } catch (e) {
    console.warn(`Failed to fetch borrow balance for mToken ${mTokenAddress} on chain ${chainId}:`, e)
    return undefined
  }
}

export function useBorrowBalance(params: { chainId: string; userAddress?: Address; mTokenAddress?: Address }) {
  const { chainId, userAddress, mTokenAddress } = params
  return useQuery({
    queryKey: ["borrowBalance", chainId, userAddress ?? "0x", mTokenAddress?.toLowerCase() ?? "0x"],
    enabled: Boolean(chainId && userAddress && mTokenAddress),
    queryFn: () => fetchBorrowBalance(chainId, userAddress as Address, mTokenAddress as Address),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
  })
}
