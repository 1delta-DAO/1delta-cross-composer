import { isMainToken } from './assetLists'

const STORAGE_KEY = '1delta-cross-composer:userTokens'

type UserTokensStorage = Record<string, string[]>

function getUserTokensFromStorage(): UserTokensStorage {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const result: UserTokensStorage = {}
      for (const [chainId, value] of Object.entries(parsed)) {
        if (Array.isArray(value)) {
          result[chainId] = value.map((addr: string) => addr.toLowerCase())
        } else if (typeof value === 'string') {
          result[chainId] = [value.toLowerCase()]
        }
      }
      return result
    }
    return {}
  } catch {
    return {}
  }
}

function saveUserTokensToStorage(tokens: UserTokensStorage): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    console.warn('Failed to save user tokens to localStorage')
  }
}

export type UserTokensRecord = Record<string, string>

export function getUserTokens(): UserTokensRecord {
  const storage = getUserTokensFromStorage()
  const result: UserTokensRecord = {}
  for (const [chainId, addresses] of Object.entries(storage)) {
    if (addresses.length > 0) {
      result[chainId] = addresses[0]
    }
  }
  return result
}

export function getUserTokensForChain(chainId: string): string[] {
  const tokens = getUserTokensFromStorage()
  return tokens[chainId] || []
}

export function isUserToken(chainId: string, address: string): boolean {
  const tokens = getUserTokensFromStorage()
  const addresses = tokens[chainId] || []
  return addresses.some((addr) => addr.toLowerCase() === address.toLowerCase())
}

export function addUserToken(chainId: string, address: string): void {
  if (isMainToken(chainId, address)) {
    return
  }

  const tokens = getUserTokensFromStorage()
  const addrLower = address.toLowerCase()
  if (!tokens[chainId]) {
    tokens[chainId] = []
  }
  if (!tokens[chainId].includes(addrLower)) {
    tokens[chainId].push(addrLower)
  }
  saveUserTokensToStorage(tokens)
}
