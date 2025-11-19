import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { useEffect } from "react"
import { setPricesFromDexscreener } from "../../lib/trade-helpers/prices"

export type PricesRecord = Record<string, Record<string, { usd: number }>>

const DEXSCREENER_TOKEN_URL = (addresses: string[]) => `https://api.dexscreener.com/latest/dex/tokens/${addresses.join(",")}`

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

  try {
    const res = await fetch(DEXSCREENER_TOKEN_URL(uniq))
    if (!res.ok) return { [chainId]: out }

    const json = (await res.json()) as DexscreenerResponse

    const priceMap: Record<string, number> = {}

    if (json.pairs) {
      for (const pair of json.pairs) {
        if (pair.priceUsd && pair.baseToken?.address) {
          const addr = pair.baseToken.address.toLowerCase()
          const price = Number(pair.priceUsd)

          if (!priceMap[addr] && isFinite(price) && price > 0) {
            priceMap[addr] = price
          }
        }
      }
    }

    for (const addr of uniq) {
      const price = priceMap[addr]
      if (price !== undefined) {
        out[addr] = { usd: price }
      }
    }
  } catch {}

  return { [chainId]: out }
}

export function useDexscreenerPrices(params: { chainId: string; addresses: Address[]; enabled?: boolean }) {
  const { chainId, addresses, enabled = true } = params
  const query = useQuery({
    queryKey: [
      "prices",
      chainId,
      addresses
        .map((a) => a.toLowerCase())
        .sort()
        .join(","),
    ],
    enabled: enabled && Boolean(chainId && addresses && addresses.length > 0),
    queryFn: () => fetchPrices(chainId, addresses),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (query.data) {
      setPricesFromDexscreener(query.data)
    }
  }, [query.data])

  return query
}
