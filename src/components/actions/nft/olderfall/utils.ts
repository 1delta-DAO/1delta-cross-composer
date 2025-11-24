/* ---------- Small helpers ---------- */

import { CurrencyHandler, SupportedChainId } from "@1delta/lib-utils"
import { TokenListsMeta } from "./types"
import { getTokenFromCache } from "../../../../lib/data/tokenListsCache"

export function formatListingPriceLabel(listing: any, tokenChainId: string | number | undefined, tokenLists?: TokenListsMeta): string {
  const tokenMeta = tokenLists && tokenChainId && listing.currency ? tokenLists[tokenChainId]?.[listing.currency.toLowerCase()] : undefined

  const decimals = typeof tokenMeta?.decimals === "number" ? tokenMeta.decimals : listing.priceDecimals
  const symbol = tokenMeta?.symbol || "TOKEN"

  try {
    const base = BigInt(listing.pricePerToken)
    const d = BigInt(decimals >= 0 ? decimals : 0)
    const denom = 10n ** d
    const whole = base / denom
    const frac = base % denom

    let fracStr = decimals > 0 ? frac.toString().padStart(Number(d), "0") : ""
    if (fracStr) {
      fracStr = fracStr.replace(/0+$/, "")
    }

    const human = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
    return `${human} ${symbol}`
  } catch {
    return `${listing.pricePerToken} ${symbol}`
  }
}

export function buildCurrencyMetaForListing(listing: any, dstChainId?: string, tokenLists?: TokenListsMeta) {
  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM
  const tokenMeta = tokenLists && tokenChainId && listing.currency ? tokenLists[tokenChainId]?.[listing.currency.toLowerCase()] : undefined

  const cachedToken = getTokenFromCache(tokenChainId, listing.currency)

  const currency: {
    chainId: string
    address: string
    symbol?: string
    decimals: number
  } = cachedToken
    ? {
        chainId: cachedToken.chainId,
        address: cachedToken.address,
        symbol: cachedToken.symbol,
        decimals: cachedToken.decimals,
      }
    : tokenMeta
    ? {
        chainId: tokenChainId,
        address: listing.currency,
        symbol: tokenMeta.symbol,
        decimals: tokenMeta.decimals ?? listing.priceDecimals,
      }
    : {
        chainId: tokenChainId,
        address: listing.currency,
        decimals: listing.priceDecimals,
      }

  const minDstAmount = CurrencyHandler.fromRawAmount(currency, listing.pricePerToken)

  return { currency, minDstAmount }
}
