import { useMemo, useState, useEffect } from 'react'
import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'
import { formatDisplayAmount } from '../../swap/swapUtils'
import { CurrencyHandler } from '../../../sdk/types'
import type { Address } from 'viem'
import { useTokenPrice } from '../../../hooks/prices/useTokenPrice'
import { zeroAddress } from 'viem'
import { getPriceWithFallback } from '../../../lib/trade-helpers/prices'

interface TransactionSummaryProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  inputAmount?: string
  outputAmount?: string
  currencyAmount?: RawCurrencyAmount
  destinationActionLabel?: string
  isRequoting?: boolean
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
  isRequoting,
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

  const srcTokenPriceAddr = useMemo(() => {
    if (!srcCurrency) return undefined
    if (srcCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(srcCurrency.chainId, zeroAddress) as Address | undefined
    }
    return srcCurrency.address as Address
  }, [srcCurrency])

  const { price: srcPrice, isLoading: srcPriceLoading } = useTokenPrice({
    chainId: srcCurrency?.chainId || '',
    tokenAddress: srcTokenPriceAddr,
    enabled: Boolean(srcCurrency),
  })

  const dstTokenPriceAddr = useMemo(() => {
    if (!dstCurrency) return undefined
    if (dstCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(dstCurrency.chainId, zeroAddress) as Address | undefined
    }
    return dstCurrency.address as Address
  }, [dstCurrency])

  const { price: dstPrice, isLoading: dstPriceLoading } = useTokenPrice({
    chainId: dstCurrency?.chainId || '',
    tokenAddress: dstTokenPriceAddr,
    enabled: Boolean(dstCurrency),
  })

  const srcPriceWithFallback = useMemo(() => {
    if (srcPrice && srcPrice > 0) return srcPrice
    if (srcCurrency && srcTokenPriceAddr) {
      return getPriceWithFallback(srcCurrency.chainId, srcTokenPriceAddr)
    }
    return undefined
  }, [srcPrice, srcCurrency, srcTokenPriceAddr])

  const dstPriceWithFallback = useMemo(() => {
    if (dstPrice && dstPrice > 0) return dstPrice
    if (dstCurrency && dstTokenPriceAddr) {
      return getPriceWithFallback(dstCurrency.chainId, dstTokenPriceAddr)
    }
    return undefined
  }, [dstPrice, dstCurrency, dstTokenPriceAddr])

  const [showCalculatingTimeout, setShowCalculatingTimeout] = useState(false)

  useEffect(() => {
    if (!inputAmount || !srcPriceWithFallback) {
      const timer = setTimeout(() => {
        setShowCalculatingTimeout(true)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setShowCalculatingTimeout(false)
    }
  }, [inputAmount, srcPriceWithFallback])

  const inputUsd = useMemo(() => {
    if (!inputAmount || !srcPriceWithFallback) return undefined
    return Number(inputAmount) * srcPriceWithFallback
  }, [inputAmount, srcPriceWithFallback])

  const outputUsd = useMemo(() => {
    if (!outputAmount || !dstPriceWithFallback) return undefined
    return Number(outputAmount) * dstPriceWithFallback
  }, [outputAmount, dstPriceWithFallback])

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
  const isCalculating = !hasInputAmount && (srcPriceLoading || dstPriceLoading || !srcPriceWithFallback)
  const formattedInput = hasInputAmount ? formatDisplayAmount(inputAmount) : showCalculatingTimeout ? 'Price unavailable' : 'Calculating...'
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
                {destinationActionLabel && <span className="ml-1 opacity-80">→ {destinationActionLabel}</span>}
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

          {isRequoting && (
            <div className="flex items-center gap-2 text-xs text-info pt-2 border-t border-base-300">
              <span className="loading loading-spinner loading-xs"></span>
              <span>Re-quoting to ensure sufficient amount...</span>
            </div>
          )}

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
