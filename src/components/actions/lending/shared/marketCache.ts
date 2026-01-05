import { type Address, zeroAddress } from 'viem'
import { erc20Abi } from 'viem'
import { getBestRpcsForChain, SupportedChainId } from '@1delta/lib-utils'
import { MOONWELL_LENS, MOONWELL_UNDERLYING_TO_MTOKEN } from '../deposit/consts'
import type { RawCurrency } from '../../../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { VenusLensAbi } from '../../../../lib/abi/compV2'
import { multicallRetryUniversal } from '@1delta/providers'
import { getTokenFromCache } from '../../../../lib/data/tokenListsCache'

export type MoonwellMarket = {
  mTokenCurrency: RawCurrency
  underlyingCurrency: RawCurrency
  symbol?: string
  decimals?: number
  isListed: boolean
  mintPaused: boolean
  borrowPaused: boolean
  exchangeRate?: bigint
}

let cachedMarkets: MoonwellMarket[] | undefined = undefined
let isLoading = false
let error: string | undefined = undefined
let isInitialized = false

type StateChangeListener = () => void
const listeners = new Set<StateChangeListener>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function subscribeToCacheChanges(listener: StateChangeListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCachedMarkets(): MoonwellMarket[] | undefined {
  return cachedMarkets
}

export function isMarketsLoading(): boolean {
  return isLoading
}

export function isMarketsReady(): boolean {
  return !isLoading && cachedMarkets !== undefined && error === undefined
}

export function hasMarketsError(): boolean {
  return error !== undefined
}

export function getMarketsError(): string | undefined {
  return error
}

export function getMarketByMToken(mToken: Address): MoonwellMarket | undefined {
  if (!cachedMarkets) return undefined
  return cachedMarkets.find((m) => m.mTokenCurrency.address.toLowerCase() === mToken.toLowerCase())
}

export function getMarketByUnderlying(underlying: Address): MoonwellMarket | undefined {
  if (!cachedMarkets) return undefined
  return cachedMarkets.find(
    (m) => m.underlyingCurrency.address.toLowerCase() === underlying.toLowerCase()
  )
}

export async function initializeMoonwellMarkets(
  chainId: string = SupportedChainId.MOONBEAM
): Promise<{ markets: MoonwellMarket[] }> {
  if (isInitialized && cachedMarkets !== undefined) {
    return { markets: cachedMarkets }
  }

  if (isLoading) {
    return { markets: cachedMarkets || [] }
  }

  if (chainId !== SupportedChainId.MOONBEAM) {
    error = 'Only moonbeam supported'
    notifyListeners()
    return { markets: [] }
  }

  isLoading = true
  error = undefined
  notifyListeners()

  try {
    const mTokenEntries = Object.entries(MOONWELL_UNDERLYING_TO_MTOKEN)
    const results: MoonwellMarket[] = []

    const marketInfoCalls = mTokenEntries.map(([, mToken]) => ({
      address: MOONWELL_LENS as Address,
      name: 'getMarketInfo' as const,
      params: [mToken as Address],
    }))

    const rpcFromRpcSelector = await getBestRpcsForChain(chainId)
    const overrides =
      rpcFromRpcSelector && rpcFromRpcSelector.length > 0
        ? { [chainId]: rpcFromRpcSelector }
        : undefined

    const marketInfosResults = await multicallRetryUniversal({
      chain: chainId,
      calls: marketInfoCalls,
      abi: VenusLensAbi,
      maxRetries: 3,
      providerId: 0,
      ...(overrides && { overrdies: overrides }),
    })

    console.log('marketInfosResults', marketInfosResults)

    const underlyingAddresses: Address[] = []
    const mTokenSymbolCalls: any[] = []
    const mTokenDecimalsCalls: any[] = []

    for (let i = 0; i < mTokenEntries.length; i++) {
      const [underlyingRaw, mToken] = mTokenEntries[i]
      const underlying = underlyingRaw as Address
      const info = marketInfosResults[i] as any

      const underlyingFromLens = (info?.[18]?.token ||
        info?.underlying ||
        info?.underlyingAssetAddress ||
        undefined) as Address | undefined
      const resolvedUnderlying = (
        underlying && underlying !== ('' as Address) ? underlying : underlyingFromLens
      ) as Address

      underlyingAddresses.push(resolvedUnderlying)

      mTokenSymbolCalls.push({
        address: mToken as Address,
        name: 'symbol' as const,
        params: [],
      })
      mTokenDecimalsCalls.push({
        address: mToken as Address,
        name: 'decimals' as const,
        params: [],
      })
    }

    const allCalls = [...mTokenSymbolCalls, ...mTokenDecimalsCalls]

    const allResults = await multicallRetryUniversal({
      chain: chainId,
      calls: allCalls,
      abi: erc20Abi,
      maxRetries: 3,
      providerId: 0,
      ...(overrides && { overrdies: overrides }),
    })

    const mTokenSymbols: (string | undefined)[] = []
    const mTokenDecimals: (number | undefined)[] = []

    for (let i = 0; i < mTokenEntries.length; i++) {
      const mTokenSymbolResult = allResults[i]
      mTokenSymbols.push(mTokenSymbolResult ? (mTokenSymbolResult as string) : undefined)
    }

    for (let i = 0; i < mTokenEntries.length; i++) {
      const mTokenDecimalsResult = allResults[mTokenEntries.length + i]
      mTokenDecimals.push(mTokenDecimalsResult ? (mTokenDecimalsResult as number) : undefined)
    }

    for (let i = 0; i < mTokenEntries.length; i++) {
      const [underlyingRaw, mToken] = mTokenEntries[i]
      const underlying = underlyingRaw as Address
      const info = marketInfosResults[i] as any
      const resolvedUnderlying = underlyingAddresses[i]

      const underlyingToken =
        resolvedUnderlying && resolvedUnderlying.toLowerCase() !== zeroAddress.toLowerCase()
          ? getTokenFromCache(chainId, resolvedUnderlying)
          : undefined

      const symbol = underlyingToken?.symbol || mTokenSymbols[i]
      const decimals = underlyingToken?.decimals ?? 18
      const mTokenSymbol = mTokenSymbols[i]
      const mTokenDecimalsValue = mTokenDecimals[i] ?? 18

      const mTokenCurrency = CurrencyHandler.Currency(
        chainId,
        mToken as Address,
        mTokenDecimalsValue,
        mTokenSymbol || 'mToken',
        mTokenSymbol || 'Moonwell Market Token'
      )

      const underlyingCurrency = CurrencyHandler.Currency(
        chainId,
        resolvedUnderlying || underlying,
        decimals,
        symbol || 'Token',
        symbol || 'Token'
      )

      const exchangeRate = info?.exchangeRate
        ? BigInt(info.exchangeRate)
        : info?.[11]
          ? BigInt(info[11])
          : undefined

      results.push({
        mTokenCurrency,
        underlyingCurrency,
        symbol,
        decimals,
        isListed: Boolean(info?.isListed),
        mintPaused: Boolean(info?.mintPaused),
        borrowPaused: Boolean(info?.borrowPaused),
        exchangeRate,
      })
    }

    cachedMarkets = results
    isInitialized = true
    error = undefined

    console.log('results', results)
    return { markets: results }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch Moonwell markets'
    cachedMarkets = undefined
    return { markets: [] }
  } finally {
    isLoading = false
    notifyListeners()
  }
}

export async function refreshMoonwellMarkets(
  chainId: string = SupportedChainId.MOONBEAM
): Promise<void> {
  isInitialized = false
  cachedMarkets = undefined
  await initializeMoonwellMarkets(chainId)
}
