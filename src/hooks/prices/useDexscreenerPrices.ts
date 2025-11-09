import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"

export type PricesRecord = Record<string, Record<string, { usd: number }>>

const DEXSCREENER_TOKEN_URL = (address: string) => `https://api.dexscreener.com/latest/dex/tokens/${address}`

type DexscreenerResponse = {
    schemaVersion?: string
    pairs?: Array<{
        chainId?: string
        priceUsd?: string
        baseToken?: { address?: string }
    }>
}

async function fetchPrices(chainId: string, addresses: Address[]): Promise<PricesRecord> {
    const out: Record<string, { usd: number }> = {}
    if (addresses.length === 0) return { [chainId]: out }

    const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase())))
    const responses = await Promise.all(
        uniq.map(async (addr) => {
            try {
                const res = await fetch(DEXSCREENER_TOKEN_URL(addr))
                if (!res.ok) return { addr, usd: undefined as unknown as number }
                const json = (await res.json()) as DexscreenerResponse
                const best = json.pairs?.find((p) => p.priceUsd && p.baseToken?.address?.toLowerCase() === addr)
                const usd = best?.priceUsd ? Number(best.priceUsd) : undefined
                return { addr, usd }
            } catch {
                return { addr, usd: undefined as unknown as number }
            }
        })
    )

    for (const r of responses) {
        if (typeof r.usd === "number" && isFinite(r.usd)) out[r.addr] = { usd: r.usd }
    }
    return { [chainId]: out }
}

export function useDexscreenerPrices(params: { chainId: string; addresses: Address[] }) {
    const { chainId, addresses } = params
    return useQuery({
        queryKey: [
            "prices",
            chainId,
            addresses
                .map((a) => a.toLowerCase())
                .sort()
                .join(","),
        ],
        enabled: Boolean(chainId && addresses && addresses.length > 0),
        queryFn: () => fetchPrices(chainId, addresses),
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: false,
    })
}
