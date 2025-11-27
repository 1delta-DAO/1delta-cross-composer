import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useEffect, useMemo } from 'react'
import { zeroAddress } from 'viem'
import { setPricesFromDexscreener } from '../../lib/trade-helpers/prices'
import type { RawCurrency } from '../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { getTokenFromCache } from '../../lib/data/tokenListsCache'

export type PricesRecord = Record<string, Record<string, { usd: number }>>

const DEXSCREENER_TOKEN_URL = (chainId: string, tokenAddress: string) => `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`

const MAIN_PRICES_ENDPOINT = 'https://margin-data.staging.1delta.io/prices/live'
const MAIN_PRICES_CACHE_DURATION = 10 * 60 * 1000

let mainPricesCache: { [key: string]: number } | null = null
let mainPricesCacheTimestamp: number = 0
let mainPricesFetchPromise: Promise<{ [key: string]: number }> | null = null

export async function fetchMainPrices(): Promise<{ [key: string]: number }> {
  const now = Date.now()

  if (mainPricesCache && now - mainPricesCacheTimestamp < MAIN_PRICES_CACHE_DURATION) {
    return mainPricesCache
  }

  if (mainPricesFetchPromise) {
    return mainPricesFetchPromise
  }

  mainPricesFetchPromise = (async (): Promise<{ [key: string]: number }> => {
    try {
      const response = await fetch(MAIN_PRICES_ENDPOINT)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const priceDataRaw = await response.json()
      const data = priceDataRaw.prices || priceDataRaw

      mainPricesCache = data
      mainPricesCacheTimestamp = now

      return data
    } catch (error) {
      console.warn('Error fetching main prices from fallback API:', error)
      return {}
    } finally {
      mainPricesFetchPromise = null
    }
  })()

  return mainPricesFetchPromise
}

export function getMainPricesCache(): { [key: string]: number } | null {
  return mainPricesCache
}

const CHAIN_ID_MAP: Record<string, string> = {
  '1': 'ethereum',
  '10': 'optimism',
  '56': 'bsc',
  '137': 'polygon',
  '42161': 'arbitrum',
  '43114': 'avalanche',
  '8453': 'base',
  '5000': 'mantle',
  '1284': 'moonbeam',
  '1285': 'moonriver',
  '9745': 'opbnb',
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

async function fetchPricesForChain(chainId: string, addresses: Address[]): Promise<Record<string, { usd: number }>> {
  const out: Record<string, { usd: number }> = {}
  if (addresses.length === 0) return out

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

  return out
}

function getPriceForCurrency(
  currency: RawCurrency,
  mainPrices: { [key: string]: number },
  dexscreenerPrices: Record<string, { usd: number }>,
  priceAddress: Address,
): { usd: number } | undefined {
  const priceKey = priceAddress.toLowerCase()

  const token = getTokenFromCache(currency.chainId, currency.address)
  const assetGroup = (token as any)?.assetGroup as string | undefined

  if (assetGroup) {
    const assetGroupPrice = mainPrices[assetGroup]
    if (assetGroupPrice !== undefined) {
      return { usd: assetGroupPrice }
    }
  }

  const dexscreenerPrice = dexscreenerPrices[priceKey]
  if (dexscreenerPrice) {
    return dexscreenerPrice
  }

  return undefined
}

export async function fetchPrices(currencies: RawCurrency[]): Promise<PricesRecord> {
  if (currencies.length === 0) return {}

  const mainPrices = await fetchMainPrices()

  const currenciesByChain: Record<string, Array<{ currency: RawCurrency; priceAddress: Address }>> = {}

  for (const currency of currencies) {
    if (!currency?.chainId || !currency?.address) continue

    const chainId = currency.chainId
    const addr = currency.address.toLowerCase()

    const priceAddress =
      addr === zeroAddress.toLowerCase()
        ? (CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress) as Address | undefined) || (zeroAddress as Address)
        : (currency.address as Address)

    if (!currenciesByChain[chainId]) {
      currenciesByChain[chainId] = []
    }

    currenciesByChain[chainId].push({ currency, priceAddress })
  }

  const chainPromises = Object.entries(currenciesByChain).map(async ([chainId, items]) => {
    const uniqueAddresses = Array.from(new Set(items.map((item) => item.priceAddress.toLowerCase()))) as Address[]

    const dexscreenerPrices = await fetchPricesForChain(chainId, uniqueAddresses)

    const result: Record<string, { usd: number }> = {}
    for (const { currency, priceAddress } of items) {
      const price = getPriceForCurrency(currency, mainPrices, dexscreenerPrices, priceAddress)

      if (price) {
        const currencyKey = currency.address.toLowerCase()
        result[currencyKey] = price
      }
    }

    return { chainId, prices: result }
  })

  const results = await Promise.all(chainPromises)

  const output: PricesRecord = {}
  for (const { chainId, prices } of results) {
    output[chainId] = prices
  }

  return output
}

export function usePriceQuery(params: { currencies: RawCurrency[]; enabled?: boolean }) {
  const { currencies, enabled = true } = params

  const queryKey = useMemo(
    () => [
      'prices',
      currencies
        .map((c) => `${c.chainId}:${c.address.toLowerCase()}`)
        .sort()
        .join(','),
    ],
    [currencies],
  )

  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(currencies && currencies.length > 0),
    queryFn: () => fetchPrices(currencies),
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
