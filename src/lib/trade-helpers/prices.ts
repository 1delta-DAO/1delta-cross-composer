import type { useGeneralPricesCallbackType } from "@1delta/lib-utils/dist/types/priceQuery"
import { zeroAddress } from "viem"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"
import { getTokenFromCache } from "../data/tokenListsCache"

const pricesCache: Record<string, Record<string, number>> = {}

function setPrices(chainId: string, addressToUsd: Record<string, number>): void {
  if (!chainId || !addressToUsd) return
  const lowercased: Record<string, number> = {}
  for (const [addr, usd] of Object.entries(addressToUsd)) {
    if (!addr) continue
    const a = addr.toLowerCase()
    if (Number.isFinite(usd) && usd > 0) {
      lowercased[a] = usd
    }
  }
  if (!pricesCache[chainId]) pricesCache[chainId] = {}
  Object.assign(pricesCache[chainId], lowercased)
}

export function setPricesFromDexscreener(record: Record<string, Record<string, { usd: number }>>): void {
  for (const [chainId, addrMap] of Object.entries(record || {})) {
    const flat: Record<string, number> = {}
    for (const [addr, obj] of Object.entries(addrMap || {})) {
      if (obj && Number.isFinite(obj.usd)) {
        flat[addr.toLowerCase()] = obj.usd
      }
    }
    setPrices(chainId, flat)
  }
}

function resolvePriceAddress(chainId: string | undefined, address: string | undefined): string | undefined {
  if (!chainId || !address) return undefined
  const lower = address.toLowerCase()
  if (lower === zeroAddress.toLowerCase()) {
    const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
    return wrapped?.toLowerCase() || lower
  }
  return lower
}

function stablecoinFallbackPrice(chainId?: string, address?: string): number | undefined {
  if (!chainId || !address) return undefined
  const token = getTokenFromCache(chainId, address)
  const symbol = (token as any)?.symbol?.toUpperCase?.() || ""
  const assetGroup = (token as any)?.assetGroup || ""
  if (assetGroup === "USDC") return 1
  if (symbol === "USDC" || symbol === "USDT" || symbol === "DAI" || symbol === "USDBC" || symbol === "XCUSDC") return 1
  return undefined
}

function getPrice(chainId: string | undefined, address: string | undefined): number {
  if (!chainId || !address) return 0
  const resolved = resolvePriceAddress(chainId, address)
  if (!resolved) return 0
  const cached = pricesCache[chainId]?.[resolved]
  if (cached && Number.isFinite(cached) && cached > 0) return cached
  const fallback = stablecoinFallbackPrice(chainId, resolved)
  return fallback ?? 0
}

export const getPricesCallback: useGeneralPricesCallbackType = (priceQueries) => {
  return priceQueries.map((q) => {
    if (!q.chainId || !q.asset) {
      return 0
    }

    const assetLower = q.asset.toLowerCase()
    const resolvedAsset =
      assetLower === zeroAddress.toLowerCase()
        ? CurrencyHandler.wrappedAddressFromAddress(q.chainId, zeroAddress)?.toLowerCase() || assetLower
        : assetLower

    const price = getPrice(q.chainId, resolvedAsset)

    return price
  })
}
