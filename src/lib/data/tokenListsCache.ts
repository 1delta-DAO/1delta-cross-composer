import { SUPPORTED_CHAIN_IDS } from "./chainIds"
import type { RawCurrency } from "@1delta/lib-utils"
import type { VersionedDeltaTokenList } from "../types/tokenList"

let cachedTokenLists: Record<string, Record<string, RawCurrency>> | null = null

export async function loadTokenLists(): Promise<Record<string, Record<string, RawCurrency>>> {
  if (cachedTokenLists) return cachedTokenLists

  const lists: Record<string, VersionedDeltaTokenList> = {}
  for (const chainId of SUPPORTED_CHAIN_IDS) {
    try {
      const module = await import(`./assets/${chainId}.json`)
      lists[chainId] = (module.default || module) as VersionedDeltaTokenList
    } catch (e) {
      console.warn(`Failed to load asset list for chain ${chainId}:`, e)
    }
  }

  const normalized: Record<string, Record<string, RawCurrency>> = {}
  for (const [chainId, list] of Object.entries(lists)) {
    normalized[chainId] = list?.list ? { ...list.list } : {}
  }

  cachedTokenLists = normalized
  return normalized
}

export function getTokenListsCache(): Record<string, Record<string, RawCurrency>> | null {
  return cachedTokenLists
}

export function getTokenFromCache(chainId: string, address: string): RawCurrency | undefined {
  return cachedTokenLists?.[chainId]?.[address.toLowerCase()]
}
