import { useMemo, useState, useEffect } from 'react'
import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'
import { formatDisplayAmount } from '../../actionsTab/swapUtils'
import { CurrencyHandler } from '../../../sdk/types'
import { usePriceQuery } from '../../../hooks/prices/usePriceQuery'

interface TransactionSummaryProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  inputAmount?: string
  outputAmount?: string
  currencyAmount?: RawCurrencyAmount
  destinationActionLabel?: string
  route?: string
  chains?: Record<string, { data?: { name?: string } }>
}

export function TransactionSummary({
  srcCurrency,
  dstCurrency,
  inputAmount,
  outputAmount: outputAmountProp,
  currencyAmount,
  destinationActionLabel,
  route,
  chains,
}: TransactionSummaryProps) {
  const outputAmount = useMemo(() => {
    if (outputAmountProp) return outputAmountProp
    if (currencyAmount) {
      const amount = CurrencyHandler.toExactNumber(currencyAmount)
      return amount > 0 ? amount.toString() : undefined
    }
    return undefined
  }, [outputAmountProp, currencyAmount])

  const shouldShow = useMemo(() => {
    return srcCurrency && dstCurrency && outputAmount && Number(outputAmount) > 0
  }, [srcCurrency, dstCurrency, outputAmount])

  const currenciesForPrice = useMemo(() => {
    const currencies: RawCurrency[] = []
    if (srcCurrency) currencies.push(srcCurrency)
    if (dstCurrency) currencies.push(dstCurrency)
    return currencies
  }, [srcCurrency, dstCurrency])

  const { data: pricesData } = usePriceQuery({
    currencies: currenciesForPrice,
    enabled: currenciesForPrice.length > 0,
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

  const [showCalculatingTimeout, setShowCalculatingTimeout] = useState(false)

  useEffect(() => {
    if (!inputAmount || !srcPrice) {
      const timer = setTimeout(() => {
        setShowCalculatingTimeout(true)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setShowCalculatingTimeout(false)
    }
  }, [inputAmount, srcPrice])

  const inputUsd = useMemo(() => {
    if (!inputAmount || !srcPrice) return undefined
    return Number(inputAmount) * srcPrice
  }, [inputAmount, srcPrice])

  const outputUsd = useMemo(() => {
    if (!outputAmount || !dstPrice) return undefined
    return Number(outputAmount) * dstPrice
  }, [outputAmount, dstPrice])

  const srcChainName = useMemo(() => {
    if (!srcCurrency?.chainId || !chains) return srcCurrency?.chainId
    return chains[srcCurrency.chainId]?.data?.name || srcCurrency.chainId
  }, [srcCurrency?.chainId, chains])

  const dstChainName = useMemo(() => {
    if (!dstCurrency?.chainId || !chains) return dstCurrency?.chainId
    return chains[dstCurrency.chainId]?.data?.name || dstCurrency.chainId
  }, [dstCurrency?.chainId, chains])

  if (!shouldShow) return null

  const hasInputAmount = inputAmount && Number(inputAmount) > 0
  const formattedInput = hasInputAmount
    ? formatDisplayAmount(inputAmount)
    : showCalculatingTimeout
      ? 'Price unavailable'
      : 'Calculating...'
  const formattedOutput = formatDisplayAmount(outputAmount || '0')

  return (
    <div className="card bg-base-200 shadow-sm border border-base-300 mt-4">
      <div className="card-body p-4">
        <div className="text-sm font-semibold mb-3">Transaction Details</div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm opacity-70">You'll pay:</span>
              <span className="font-medium">
                {hasInputAmount ? (
                  <>
                    {formattedInput} {srcCurrency?.symbol}
                  </>
                ) : (
                  <span className="opacity-60">{formattedInput}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-50"></span>
              <div className="text-xs opacity-60">
                {inputUsd !== undefined && isFinite(inputUsd) ? `$${inputUsd.toFixed(2)}` : ''}
                {srcChainName && <span className="ml-2">({srcChainName})</span>}
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm opacity-70">You'll receive:</span>
              <span className="font-medium">
                {formattedOutput} {dstCurrency?.symbol}
                {destinationActionLabel && (
                  <span className="ml-1 opacity-80">→ {destinationActionLabel}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-50"></span>
              <div className="text-xs opacity-60">
                {outputUsd !== undefined && isFinite(outputUsd) ? `$${outputUsd.toFixed(2)}` : ''}
                {dstChainName && <span className="ml-2">({dstChainName})</span>}
              </div>
            </div>
          </div>

          {route && (
            <div className="pt-2 border-t border-base-300">
              <div className="text-xs opacity-60">Route: {route}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
