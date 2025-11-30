import { type Address, zeroAddress } from 'viem'
import { erc20Abi } from 'viem'
import { getRpcSelectorEvmClient, SupportedChainId } from '@1delta/lib-utils'
import { MOONWELL_LENS, MOONWELL_UNDERLYING_TO_MTOKEN } from './consts'
import type { RawCurrency } from '../../../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { VenusLensAbi } from '../../../../lib/abi/compV2'

export type MoonwellMarket = {
  mTokenCurrency: RawCurrency
  underlyingCurrency: RawCurrency
  symbol?: string
  decimals?: number
  isListed: boolean
  mintPaused: boolean
  borrowPaused: boolean
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
): Promise<void> {
  if (isInitialized && cachedMarkets !== undefined) {
    return
  }

  if (isLoading) {
    return
  }

  if (chainId !== SupportedChainId.MOONBEAM) {
    error = 'Only moonbeam supported'
    notifyListeners()
    return
  }

  isLoading = true
  error = undefined
  notifyListeners()

  try {
    const client = await getRpcSelectorEvmClient(chainId)
    if (!client) {
      throw new Error('No client for chain')
    }

    const results: MoonwellMarket[] = []

    for (const [underlyingRaw, mToken] of Object.entries(MOONWELL_UNDERLYING_TO_MTOKEN)) {
      const underlying = underlyingRaw as Address

      // getMarketInfo(mToken) returns Market struct (see ABI)
      const info = (await client.readContract({
        address: MOONWELL_LENS,
        abi: VenusLensAbi,
        functionName: 'getMarketInfo',
        args: [mToken],
      })) as any
      const underlyingFromLens = (info?.[18]?.token ||
        info?.underlying ||
        info?.underlyingAssetAddress ||
        undefined) as Address | undefined
      const resolvedUnderlying = (
        underlying && underlying !== ('' as Address) ? underlying : underlyingFromLens
      ) as Address

      let symbol: string | undefined
      let decimals: number | undefined
      try {
        if (resolvedUnderlying && resolvedUnderlying.toLowerCase() !== zeroAddress.toLowerCase()) {
          symbol = (await client.readContract({
            address: resolvedUnderlying,
            abi: erc20Abi,
            functionName: 'symbol',
          })) as string
          decimals = (await client.readContract({
            address: resolvedUnderlying,
            abi: erc20Abi,
            functionName: 'decimals',
          })) as number
        } else {
          // fallback to mToken symbol
          symbol = (await client.readContract({
            address: mToken,
            abi: erc20Abi,
            functionName: 'symbol',
          })) as string
          decimals = 18
        }
      } catch {}

      let mTokenSymbol: string | undefined
      let mTokenDecimals: number | undefined
      try {
        mTokenSymbol = (await client.readContract({
          address: mToken,
          abi: erc20Abi,
          functionName: 'symbol',
        })) as string
        mTokenDecimals = (await client.readContract({
          address: mToken,
          abi: erc20Abi,
          functionName: 'decimals',
        })) as number
      } catch {}

      const mTokenCurrency = CurrencyHandler.Currency(
        chainId,
        mToken,
        mTokenDecimals ?? 18,
        mTokenSymbol || 'mToken',
        mTokenSymbol || 'Moonwell Market Token'
      )

      const underlyingCurrency = CurrencyHandler.Currency(
        chainId,
        resolvedUnderlying || underlying,
        decimals ?? 18,
        symbol || 'Token',
        symbol || 'Token'
      )

      results.push({
        mTokenCurrency,
        underlyingCurrency,
        symbol,
        decimals,
        isListed: Boolean(info?.isListed),
        mintPaused: Boolean(info?.mintPaused),
        borrowPaused: Boolean(info?.borrowPaused),
      })
    }

    cachedMarkets = results
    isInitialized = true
    error = undefined
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch Moonwell markets'
    cachedMarkets = undefined
  } finally {
    isLoading = false
    notifyListeners()
  }
}

/**
 * Force refresh the markets data
 */
export async function refreshMoonwellMarkets(
  chainId: string = SupportedChainId.MOONBEAM
): Promise<void> {
  isInitialized = false
  cachedMarkets = undefined
  await initializeMoonwellMarkets(chainId)
}
