import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useMemo } from 'react'
import { zeroAddress } from 'viem'
import type { RawCurrency } from '../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'

export type PricesRecord = Record<string, Record<string, { usd: number }>>

const DEXSCREENER_TOKENS_URL = (chainId: string, addresses: string[]) =>
  `https://api.dexscreener.com/tokens/v1/${chainId}/${addresses.join(',')}`

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

async function fetchDexscreenerPrices(
  chainId: string,
  addresses: string[]
): Promise<Record<string, { usd: number }>> {
  const result: Record<string, { usd: number }> = {}

  if (addresses.length === 0) return result

  const dexscreenerChainId = getDexscreenerChainId(chainId)
  const uniqueAddresses = Array.from(new Set(addresses.map((a) => a.toLowerCase())))
  const url = DEXSCREENER_TOKENS_URL(dexscreenerChainId, uniqueAddresses)

  try {
    const res = await fetch(url)
    if (!res.ok) return result

    const json = (await res.json()) as DexscreenerResponse

    if (!json || json.length === 0) return result

    const pricesByAddress: Record<string, { price: number; liquidity: number; volume: number }> = {}

    for (const pair of json) {
      if (!pair.priceUsd || !pair.baseToken?.address) continue

      const addr = pair.baseToken.address.toLowerCase()
      if (!uniqueAddresses.includes(addr)) continue

      const price = Number(pair.priceUsd)
      if (!isFinite(price) || price <= 0) continue

      const liquidity = pair.liquidity?.usd ? Number(pair.liquidity.usd) : 0
      const volume = pair.volume?.h24 ? Number(pair.volume.h24) : 0

      const existing = pricesByAddress[addr]
      if (
        !existing ||
        liquidity > existing.liquidity ||
        (liquidity === existing.liquidity && volume > existing.volume)
      ) {
        pricesByAddress[addr] = { price, liquidity, volume }
      }
    }

    for (const [addr, { price }] of Object.entries(pricesByAddress)) {
      result[addr] = { usd: price }
    }

    return result
  } catch {
    return result
  }
}

export async function fetchPrices(currencies: RawCurrency[]): Promise<PricesRecord> {
  if (currencies.length === 0) return {}

  const mainPrices = await fetchMainPrices()

  const currenciesWithMainPrice: Array<{ currency: RawCurrency; price: { usd: number } }> = []
  const currenciesNeedingDexscreener: Array<{ currency: RawCurrency; priceAddress: Address }> = []

  for (const currency of currencies) {
    if (!currency?.chainId || !currency?.address) continue

    const chainId = currency.chainId
    const addr = currency.address.toLowerCase()

    const priceAddress =
      addr === zeroAddress.toLowerCase()
        ? (CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress) as
            | Address
            | undefined) || (zeroAddress as Address)
        : (currency.address as Address)

    const assetGroup = currency?.assetGroup as string | undefined

    if (assetGroup) {
      const assetGroupPrice = mainPrices[assetGroup]
      if (assetGroupPrice !== undefined) {
        currenciesWithMainPrice.push({ currency, price: { usd: assetGroupPrice } })
        continue
      }
    }

    currenciesNeedingDexscreener.push({ currency, priceAddress })
  }

  const currenciesByChain: Record<
    string,
    Array<{ currency: RawCurrency; priceAddress: Address }>
  > = {}

  for (const { currency, priceAddress } of currenciesNeedingDexscreener) {
    const chainId = currency.chainId
    if (!currenciesByChain[chainId]) {
      currenciesByChain[chainId] = []
    }
    currenciesByChain[chainId].push({ currency, priceAddress })
  }

  const chainPromises = Object.entries(currenciesByChain).map(async ([chainId, items]) => {
    const uniqueAddresses = Array.from(
      new Set(items.map((item) => item.priceAddress.toLowerCase()))
    ) as Address[]

    const dexscreenerPrices = await fetchDexscreenerPrices(chainId, uniqueAddresses)

    const result: Record<string, { usd: number }> = {}
    for (const { currency, priceAddress } of items) {
      const priceKey = priceAddress.toLowerCase()
      const dexscreenerPrice = dexscreenerPrices[priceKey]

      if (dexscreenerPrice) {
        const currencyKey = currency.address.toLowerCase()
        result[currencyKey] = dexscreenerPrice
      }
    }

    return { chainId, prices: result }
  })

  const results = await Promise.all(chainPromises)

  const output: PricesRecord = {}

  for (const { currency, price } of currenciesWithMainPrice) {
    const chainId = currency.chainId
    if (!output[chainId]) {
      output[chainId] = {}
    }
    const currencyKey = currency.address.toLowerCase()
    output[chainId][currencyKey] = price
  }

  for (const { chainId, prices } of results) {
    if (!output[chainId]) {
      output[chainId] = {}
    }
    Object.assign(output[chainId], prices)
  }

  return output
}

export function usePriceQuery(params: { currencies: RawCurrency[]; enabled?: boolean }) {
  const { currencies, enabled = true } = params

  const queryKey = useMemo(() => {
    const keys: Set<string> = new Set()
    for (const currency of currencies) {
      if (currency.assetGroup) {
        keys.add(currency.assetGroup)
      } else {
        keys.add(currency.address.toLowerCase())
      }
    }
    return ['prices', ...Array.from(keys).sort().join(',')]
  }, [currencies])

  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(currencies && currencies.length > 0),
    queryFn: () => fetchPrices(currencies),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })

  return query
}
