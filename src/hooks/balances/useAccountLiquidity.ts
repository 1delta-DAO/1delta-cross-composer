import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { readContract } from "viem/actions"
import { getRpcSelectorEvmClient } from "@1delta/lib-utils"
import { MOONWELL_COMPTROLLER } from "../../lib/moonwell/marketCache"

const COMPTROLLER_ABI = [
    {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "getAccountLiquidity",
        outputs: [
            { internalType: "uint256", name: "error", type: "uint256" },
            { internalType: "uint256", name: "liquidity", type: "uint256" },
            { internalType: "uint256", name: "shortfall", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const

export type AccountLiquidity = {
    error: bigint
    liquidity: bigint
    shortfall: bigint
} | null

async function fetchAccountLiquidity(chainId: string, userAddress: Address): Promise<AccountLiquidity> {
    try {
        const client = await getRpcSelectorEvmClient(chainId)
        if (!client) return null

        const result = await readContract(client, {
            address: MOONWELL_COMPTROLLER,
            abi: COMPTROLLER_ABI,
            functionName: "getAccountLiquidity",
            args: [userAddress],
        })

        return {
            error: BigInt(result[0].toString()),
            liquidity: BigInt(result[1].toString()),
            shortfall: BigInt(result[2].toString()),
        }
    } catch (e) {
        console.warn(`Failed to fetch account liquidity on chain ${chainId}:`, e)
        return null
    }
}

export function useAccountLiquidity(params: { chainId: string; userAddress?: Address }) {
    const { chainId, userAddress } = params
    return useQuery({
        queryKey: ["accountLiquidity", chainId, userAddress ?? "0x"],
        enabled: Boolean(chainId && userAddress),
        queryFn: () => fetchAccountLiquidity(chainId, userAddress as Address),
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // 1 minute
        refetchOnWindowFocus: false,
    })
}
