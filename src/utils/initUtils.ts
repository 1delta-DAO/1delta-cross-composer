import { CurrencyGetter } from '@1delta/lib-utils/dist/types/currencyGetter'
import { RawCurrency } from '../types/currency'
import { getCurrency } from '../lib/trade-helpers/utils'
import { Address, zeroAddress } from 'viem'
import { CurrencyHandler, PriceGetter } from '@1delta/lib-utils'
import { getMainPricesCache } from '../hooks/prices/usePriceQuery'

export const priceGetter: PriceGetter = (priceQueries) => {
  if (priceQueries.length === 0) return []

  const mainPrices = getMainPricesCache() || {}

  const results: number[] = []

  for (let i = 0; i < priceQueries.length; i++) {
    const query = priceQueries[i]
    if (!query.chainId || !query.tokenAddress) {
      results[i] = 0
      continue
    }

    const addr = query.tokenAddress.toLowerCase()
    const priceAddress =
      addr === zeroAddress.toLowerCase()
        ? (CurrencyHandler.wrappedAddressFromAddress(query.chainId, zeroAddress) as
            | Address
            | undefined) || (zeroAddress as Address)
        : (query.tokenAddress as Address)

    const currency = getCurrency(query.chainId, priceAddress)
    if (currency?.assetGroup) {
      const assetGroupPrice = mainPrices[currency.assetGroup]
      if (assetGroupPrice !== undefined) {
        results[i] = assetGroupPrice
        continue
      }
    }

    results[i] = 0
  }

  return results
}

export const currencyGetter: CurrencyGetter = (
  chainId: string | undefined,
  tokenAddress: string | undefined
): RawCurrency => {
  if (!chainId || !tokenAddress) {
    throw new Error('Invalid currency parameters')
  }
  const currency = getCurrency(chainId, tokenAddress as Address)
  if (!currency) {
    throw new Error(`Currency not found for ${chainId}:${tokenAddress}`)
  }
  return currency
}
