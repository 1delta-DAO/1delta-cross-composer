import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { useEffect } from "react"
import { setPricesFromDexscreener } from "../../lib/trade-helpers/prices"

export type PricesRecord = Record<string, Record<string, { usd: number }>>

const DEXSCREENER_TOKEN_URL = (chainId: string, tokenAddress: string) => `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`

const CHAIN_ID_MAP: Record<string, string> = {
  "1": "ethereum",
  "10": "optimism",
  "56": "bsc",
  "137": "polygon",
  "42161": "arbitrum",
  "43114": "avalanche",
  "8453": "base",
  "5000": "mantle",
  "1284": "moonbeam",
  "1285": "moonriver",
  "9745": "opbnb",
}

export function getDexscreenerChainId(chainId: string): string {
  return CHAIN_ID_MAP[chainId] || chainId.toLowerCase()
}

type DexscreenerResponse = Array<{
  chainId?: string
  priceUsd?: string
  baseToken?: {
    address?: string
    name?: string
    symbol?: string
  }
  quoteToken?: {
    address?: string
    name?: string
    symbol?: string
  }
  liquidity?: {
    usd?: number
    base?: number
    quote?: number
  }
  volume?: {
    h24?: number
    h6?: number
    h1?: number
    m5?: number
  }
}>

async function fetchTokenPrice(chainId: string, tokenAddress: string): Promise<number | undefined> {
  const dexscreenerChainId = getDexscreenerChainId(chainId)
  const url = DEXSCREENER_TOKEN_URL(dexscreenerChainId, tokenAddress.toLowerCase())

  try {
    const res = await fetch(url)
    if (!res.ok) return undefined

    const json = (await res.json()) as DexscreenerResponse

    if (!json || json.length === 0) return undefined

    let bestPrice: number | undefined
    let bestLiquidity = 0
    let bestVolume = 0

    for (const pair of json) {
      if (!pair.priceUsd || !pair.baseToken?.address) continue

      const addr = pair.baseToken.address.toLowerCase()
      if (addr !== tokenAddress.toLowerCase()) continue

      const price = Number(pair.priceUsd)
      if (!isFinite(price) || price <= 0) continue

      const liquidity = pair.liquidity?.usd ? Number(pair.liquidity.usd) : 0
      const volume = pair.volume?.h24 ? Number(pair.volume.h24) : 0

      if (!bestPrice || liquidity > bestLiquidity || (liquidity === bestLiquidity && volume > bestVolume)) {
        bestPrice = price
        bestLiquidity = liquidity
        bestVolume = volume
      }
    }

    return bestPrice
  } catch {
    return undefined
  }
}

export async function fetchPrices(chainId: string, addresses: Address[]): Promise<PricesRecord> {
  const out: Record<string, { usd: number }> = {}
  if (addresses.length === 0) return { [chainId]: out }

  const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase())))

  const pricePromises = uniq.map(async (addr) => {
    const price = await fetchTokenPrice(chainId, addr)
    return { addr, price }
  })

  const results = await Promise.all(pricePromises)

  for (const { addr, price } of results) {
    if (price !== undefined && price > 0) {
      out[addr] = { usd: price }
    }
  }

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
