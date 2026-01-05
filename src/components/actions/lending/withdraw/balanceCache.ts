import { type Address } from 'viem'
import { erc20Abi } from 'viem'
import { getBestRpcsForChain } from '@1delta/lib-utils'
import type { MoonwellMarket } from '../shared/marketCache'
import { multicallRetryUniversal } from '@1delta/providers'

type BalanceCache = Record<string, Record<string, Record<string, bigint>>>

let cachedBalances: BalanceCache = {}
let loadingStates: Record<string, Record<string, boolean>> = {}
let errorStates: Record<string, Record<string, string | undefined>> = {}

type StateChangeListener = () => void
const listeners = new Set<StateChangeListener>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function subscribeToBalanceChanges(listener: StateChangeListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCachedBalance(
  chainId: string,
  userAddress: Address,
  mTokenAddress: Address
): bigint | undefined {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()
  const mTokenKey = mTokenAddress.toLowerCase()
  return cachedBalances[chainKey]?.[userKey]?.[mTokenKey]
}

export function getCachedBalances(chainId: string, userAddress: Address): Record<string, bigint> {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()
  return cachedBalances[chainKey]?.[userKey] || {}
}

export function isBalancesLoading(chainId: string, userAddress: Address): boolean {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()
  return loadingStates[chainKey]?.[userKey] || false
}

export function isBalancesReady(chainId: string, userAddress: Address): boolean {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()
  return (
    !loadingStates[chainKey]?.[userKey] &&
    cachedBalances[chainKey]?.[userKey] !== undefined &&
    errorStates[chainKey]?.[userKey] === undefined
  )
}

export function hasBalancesError(chainId: string, userAddress: Address): boolean {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()
  return errorStates[chainKey]?.[userKey] !== undefined
}

export function getBalancesError(chainId: string, userAddress: Address): string | undefined {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()
  return errorStates[chainKey]?.[userKey]
}

export async function initializeUserLendingBalances(
  chainId: string,
  userAddress: Address,
  markets: MoonwellMarket[]
): Promise<void> {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()

  if (loadingStates[chainKey]?.[userKey]) {
    return
  }

  if (!cachedBalances[chainKey]) {
    cachedBalances[chainKey] = {}
  }
  if (!cachedBalances[chainKey][userKey]) {
    cachedBalances[chainKey][userKey] = {}
  }
  if (!loadingStates[chainKey]) {
    loadingStates[chainKey] = {}
  }
  if (!errorStates[chainKey]) {
    errorStates[chainKey] = {}
  }

  loadingStates[chainKey][userKey] = true
  errorStates[chainKey][userKey] = undefined
  notifyListeners()

  try {
    const balanceCalls = markets.map((market) => ({
      address: market.mTokenCurrency.address as Address,
      name: 'balanceOf' as const,
      params: [userAddress],
    }))

    const rpcFromRpcSelector = await getBestRpcsForChain(chainId)
    const overrides =
      rpcFromRpcSelector && rpcFromRpcSelector.length > 0
        ? { [chainId]: rpcFromRpcSelector }
        : undefined

    const balanceResults = await multicallRetryUniversal({
      chain: chainId,
      calls: balanceCalls,
      abi: erc20Abi,
      maxRetries: 3,
      providerId: 0,
      ...(overrides && { overrdies: overrides }),
    })

    const balanceMap: Record<string, bigint> = {}
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i]
      const mTokenKey = market.mTokenCurrency.address.toLowerCase()
      const result = balanceResults[i]
      const balance = result ? (result as bigint) : 0n
      cachedBalances[chainKey][userKey][mTokenKey] = balance
      balanceMap[mTokenKey] = balance
    }

    errorStates[chainKey][userKey] = undefined
  } catch (e) {
    errorStates[chainKey][userKey] =
      e instanceof Error ? e.message : 'Failed to fetch lending balances'
    cachedBalances[chainKey][userKey] = {}
  } finally {
    loadingStates[chainKey][userKey] = false
    notifyListeners()
  }
}

export function setCachedBalances(
  chainId: string,
  userAddress: Address,
  balances: Record<string, bigint>
): void {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()

  if (!cachedBalances[chainKey]) {
    cachedBalances[chainKey] = {}
  }
  cachedBalances[chainKey][userKey] = balances
  notifyListeners()
}

export async function refreshUserLendingBalances(
  chainId: string,
  userAddress: Address,
  markets: MoonwellMarket[]
): Promise<void> {
  const chainKey = chainId
  const userKey = userAddress.toLowerCase()

  if (cachedBalances[chainKey]?.[userKey]) {
    delete cachedBalances[chainKey][userKey]
  }

  await initializeUserLendingBalances(chainId, userAddress, markets)
}

export async function waitForBalances(
  chainId: string,
  userAddress: Address,
  markets: MoonwellMarket[]
): Promise<Record<string, bigint>> {
  return new Promise((resolve) => {
    if (isBalancesReady(chainId, userAddress)) {
      const balances = getCachedBalances(chainId, userAddress)
      resolve(balances)
      return
    }

    initializeUserLendingBalances(chainId, userAddress, markets).then(() => {
      if (isBalancesReady(chainId, userAddress)) {
        const balances = getCachedBalances(chainId, userAddress)
        resolve(balances)
      } else {
        resolve({})
      }
    })

    const unsubscribe = subscribeToBalanceChanges(() => {
      if (isBalancesReady(chainId, userAddress)) {
        const balances = getCachedBalances(chainId, userAddress)
        unsubscribe()
        resolve(balances)
      }
    })
  })
}
