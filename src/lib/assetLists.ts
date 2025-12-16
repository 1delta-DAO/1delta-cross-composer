import { SUPPORTED_CHAIN_IDS } from './data/chainIds'
import type { RawCurrency } from '../types/currency'

export type TokenListsRecord = Record<string, Record<string, RawCurrency>>
export interface DeltaTokenList {
  chainId: string
  version: string
  list: Record<string, RawCurrency>
  mainTokens: string[]
}

let cachedTokenLists: TokenListsRecord | null = null
let cachedMainTokens: Record<string, Set<string>> | null = null
let loadPromise: Promise<TokenListsRecord> | null = null

type ReadyListener = () => void
const listeners = new Set<ReadyListener>()

const getListUrl = (chainId: string) =>
  `https://raw.githubusercontent.com/1delta-DAO/token-lists/main/${chainId}.json`

async function fetchList(chainId: string): Promise<DeltaTokenList | null> {
  try {
    const url = getListUrl(chainId)
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(
        `Failed to fetch asset list for chain ${chainId}: ${response.status} ${response.statusText}`
      )
      return null
    }
    const data = (await response.json()) as DeltaTokenList
    return data
  } catch (error) {
    console.warn(`Error fetching asset list for chain ${chainId}:`, error)
    return null
  }
}

function notifyReady() {
  listeners.forEach((listener) => listener())
}

export async function loadTokenLists(): Promise<TokenListsRecord> {
  if (cachedTokenLists) return cachedTokenLists
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const lists: TokenListsRecord = {}
    const mainTokens: Record<string, Set<string>> = {}

    for (const chainId of SUPPORTED_CHAIN_IDS) {
      const list = await fetchList(chainId)
      if (!list || !list.list) continue

      const normalized: Record<string, RawCurrency> = {}
      for (const [address, token] of Object.entries(list.list)) {
        normalized[address.toLowerCase()] = token
      }

      lists[chainId] = normalized

      const mainTokensSet = new Set<string>()
      if (list.mainTokens && Array.isArray(list.mainTokens)) {
        for (const address of list.mainTokens) {
          mainTokensSet.add(address.toLowerCase())
        }
      }
      mainTokens[chainId] = mainTokensSet
    }

    cachedTokenLists = lists
    cachedMainTokens = mainTokens
    notifyReady()
    return lists
  })()

  return loadPromise
}

export function getTokenListsCache(): TokenListsRecord | null {
  return cachedTokenLists
}

export function getTokenFromCache(chainId: string, address: string): RawCurrency | undefined {
  return cachedTokenLists?.[chainId]?.[address.toLowerCase()]
}

export function isTokenListsReady(): boolean {
  return cachedTokenLists !== null
}

export function subscribeTokenListsReady(listener: ReadyListener): () => void {
  listeners.add(listener)
  if (cachedTokenLists) {
    listener()
  }
  return () => {
    listeners.delete(listener)
  }
}

export function getMainTokensCache(): Record<string, Set<string>> | null {
  return cachedMainTokens
}

export function isMainToken(chainId: string, address: string): boolean {
  return cachedMainTokens?.[chainId]?.has(address.toLowerCase()) ?? false
}
