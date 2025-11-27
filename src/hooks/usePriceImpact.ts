import { useMemo } from 'react'
import { CurrencyHandler, type GenericTrade } from '../sdk/types'
import { usePriceQuery } from './prices/usePriceQuery'
import { getCurrency } from '../lib/trade-helpers/utils'
import { Address } from 'viem'

export function usePriceImpact({
  selectedTrade,
  amount,
  quoteOut,
  srcToken,
  dstToken,
  srcChainId,
  dstChainId,
}: {
  selectedTrade?: GenericTrade
  amount: string
  quoteOut?: string
  srcToken?: Address
  dstToken?: Address
  srcChainId?: string
  dstChainId?: string
}): number | undefined {
  const srcCurrency = useMemo(() => {
    if (!srcToken || !srcChainId) return undefined
    return getCurrency(srcChainId, srcToken as any)
  }, [srcToken, srcChainId])

  const dstCurrency = useMemo(() => {
    if (!dstToken || !dstChainId) return undefined
    return getCurrency(dstChainId, dstToken as any)
  }, [dstToken, dstChainId])

  const priceCurrencies = useMemo(() => {
    const currencies: any[] = []
    if (srcCurrency) currencies.push(srcCurrency)
    if (dstCurrency) currencies.push(dstCurrency)
    return currencies
  }, [srcCurrency, dstCurrency])

  const { data: pricesData } = usePriceQuery({
    currencies: priceCurrencies,
    enabled: priceCurrencies.length > 0,
  })

  const srcPrice = useMemo(() => {
    if (!pricesData || !srcCurrency) return undefined
    const chainId = srcCurrency.chainId
    const addressKey = srcCurrency.address?.toLowerCase()
    if (!chainId || !addressKey) return undefined
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, srcCurrency])

  const dstPrice = useMemo(() => {
    if (!pricesData || !dstCurrency) return undefined
    const chainId = dstCurrency.chainId
    const addressKey = dstCurrency.address?.toLowerCase()
    if (!chainId || !addressKey) return undefined
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, dstCurrency])

  return useMemo(() => {
    if (
      !selectedTrade ||
      !amount ||
      !quoteOut ||
      !srcToken ||
      !dstToken ||
      !srcChainId ||
      !dstChainId
    ) {
      return undefined
    }
    try {
      if (!srcPrice || !dstPrice) return undefined

      // Calculate expected output based on spot price
      const inputValue = Number(amount) * srcPrice
      const expectedOutput = inputValue / dstPrice

      // Actual output from trade
      const actualOutput = Number(quoteOut)

      if (expectedOutput <= 0 || actualOutput <= 0) return undefined

      // Price impact = (expected - actual) / expected * 100
      const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100
      return Math.max(0, impact) // Ensure non-negative
    } catch {
      return undefined
    }
  }, [
    selectedTrade,
    amount,
    quoteOut,
    srcToken,
    dstToken,
    srcChainId,
    dstChainId,
    srcPrice,
    dstPrice,
  ])
}
