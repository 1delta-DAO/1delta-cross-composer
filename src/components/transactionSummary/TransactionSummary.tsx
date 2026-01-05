import { useMemo, useState, useEffect } from 'react'
import { SummaryRow } from './SummaryRow'
import { RouteSection } from './RouteSection'
import { CurrencyHandler, RawCurrency, RawCurrencyAmount } from '@1delta/lib-utils'
import { PricesRecord } from '../../hooks/prices/usePriceQuery'
import { formatDisplayAmount } from '../actionsTab/swapUtils'
import { UnifiedState } from '../ActionSelector'
import { getRegisteredActions } from '../actions/shared/actionDefinitions'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { PayInfo } from './PayInfo'

interface TransactionSummaryProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  inputAmount?: string
  outputAmount?: string
  currencyAmount?: RawCurrencyAmount
  destinationActionLabel?: string
  inputActionLabel?: string
  isReverseFlow?: boolean
  route?: string
  pricesData?: PricesRecord
  isLoadingPrices?: boolean
  isFetchingPrices?: boolean
  state: UnifiedState
}

export function TransactionSummary({
  srcCurrency,
  dstCurrency,
  inputAmount,
  outputAmount: outputAmountProp,
  currencyAmount,
  destinationActionLabel,
  inputActionLabel,
  isReverseFlow = false,
  route,
  pricesData: pricesDataProp,
  isLoadingPrices: isLoadingPricesProp,
  isFetchingPrices: isFetchingPricesProp,
  state,
}: TransactionSummaryProps) {
  const { data: chains } = useChainsRegistry()

  const selectedDef = useMemo(() => {
    if (!state.selectedAction) return undefined
    return getRegisteredActions().find((a) => a.id === state.selectedAction)
  }, [state.selectedAction])

  const isInputDirection = selectedDef?.actionDirection === 'input'

  const actionAmount = useMemo(() => {
    if (!currencyAmount) return undefined
    const amount = CurrencyHandler.toExactNumber(currencyAmount)
    return amount > 0 ? amount.toString() : undefined
  }, [currencyAmount])

  const outputAmount = useMemo(() => {
    if (outputAmountProp) return outputAmountProp
    if (!isReverseFlow && currencyAmount) {
      const amount = CurrencyHandler.toExactNumber(currencyAmount)
      return amount > 0 ? amount.toString() : undefined
    }
    return undefined
  }, [outputAmountProp, currencyAmount, isReverseFlow])

  const shouldShow = useMemo(() => {
    if (!srcCurrency || !dstCurrency) return false
    if (isReverseFlow) {
      return Boolean(actionAmount && Number(actionAmount) > 0)
    }
    return Boolean(outputAmount && Number(outputAmount) > 0)
  }, [srcCurrency, dstCurrency, isReverseFlow, actionAmount, outputAmount])

  const pricesData = pricesDataProp
  const isLoadingPrices = isLoadingPricesProp ?? false
  const isFetchingPrices = isFetchingPricesProp ?? false
  const isPricesLoading = isLoadingPrices || isFetchingPrices

  const srcPrice = useMemo(() => {
    if (!pricesData || !srcCurrency) return undefined
    const chainId = srcCurrency.chainId
    const addressKey = srcCurrency.address?.toLowerCase()
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, srcCurrency])

  const dstPrice = useMemo(() => {
    if (!pricesData || !dstCurrency) return undefined
    const chainId = dstCurrency.chainId
    const addressKey = dstCurrency.address?.toLowerCase()
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, dstCurrency])

  const [showCalculatingTimeout, setShowCalculatingTimeout] = useState(false)

  useEffect(() => {
    setShowCalculatingTimeout(false)
  }, [srcCurrency, dstCurrency])

  useEffect(() => {
    if (isPricesLoading) {
      setShowCalculatingTimeout(false)
      return
    }

    const hasInputAmount = inputAmount && Number(inputAmount) > 0
    const hasPrices = srcPrice !== undefined && dstPrice !== undefined

    if (hasInputAmount && hasPrices) {
      setShowCalculatingTimeout(false)
      return
    }

    if (!hasInputAmount) {
      if (!hasPrices) {
        const timer = setTimeout(() => {
          setShowCalculatingTimeout(true)
        }, 5000)
        return () => clearTimeout(timer)
      }
      setShowCalculatingTimeout(true)
      return
    }

    setShowCalculatingTimeout(false)
  }, [inputAmount, srcPrice, dstPrice, isPricesLoading])

  const inputUsd = useMemo(() => {
    if (!inputAmount || !srcPrice) return undefined
    return Number(inputAmount) * srcPrice
  }, [inputAmount, srcPrice])

  const actionUsd = useMemo(() => {
    if (!actionAmount || !srcPrice) return undefined
    return Number(actionAmount) * srcPrice
  }, [actionAmount, srcPrice])

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

  const hasInputAmount = inputAmount && Number(inputAmount) > 0
  const formattedInput = hasInputAmount
    ? formatDisplayAmount(inputAmount)
    : showCalculatingTimeout
      ? 'Price unavailable'
      : 'Calculating...'

  const formattedOutput = formatDisplayAmount(outputAmount || '0')
  const formattedActionOutput = formatDisplayAmount(actionAmount || '0')

  const hasReceiveAmount = outputAmount && Number(outputAmount) > 0
  const formattedReceive = hasReceiveAmount ? formatDisplayAmount(outputAmount) : 'Calculating...'

  if (!shouldShow) return null

  const renderActionSummary = () => {
    if (!selectedDef) return null

    const isInputAction = selectedDef.actionDirection === 'input'
    const effectiveCurrency = isInputAction ? srcCurrency : dstCurrency
    const effectiveAmount = isInputAction ? formattedActionOutput : formattedOutput
    const effectiveUsd = isInputAction ? actionUsd : outputUsd
    const effectiveLabel = isInputAction ? inputActionLabel : destinationActionLabel

    if (!selectedDef.customSummary) {
      if (isInputAction) {
        return (
          <SummaryRow
            label="You'll withdraw:"
            amount={formattedActionOutput}
            currencySymbol={srcCurrency?.symbol}
            chainName={srcChainName}
            amountUsd={actionUsd}
          />
        )
      }
      return (
        <SummaryRow
          label="You'll receive:"
          amount={formattedOutput}
          currencySymbol={dstCurrency?.symbol}
          chainName={dstChainName}
          amountUsd={outputUsd}
          destinationActionLabel={destinationActionLabel}
        />
      )
    }

    return (
      <selectedDef.customSummary
        formattedOutput={effectiveAmount}
        currency={effectiveCurrency}
        outputUsd={effectiveUsd}
        actionLabel={effectiveLabel}
        actionDirection={isInputAction ? 'input' : 'destination'}
        dstCurrency={effectiveCurrency}
        destinationActionLabel={effectiveLabel}
      />
    )
  }

  return (
    <div className="card bg-base-200 shadow-sm border border-base-300 mt-4">
      <div className="card-body p-4">
        <div className="text-sm font-semibold mb-3">Transaction Summary</div>

        <div className="space-y-3">
          {!isReverseFlow && (
            <PayInfo
              label="You'll pay:"
              amount={formattedInput}
              currency={srcCurrency}
              chainName={srcChainName}
              amountUsd={inputUsd}
              showFadedAmount={!hasInputAmount}
            />
          )}
          {renderActionSummary()}
          {isReverseFlow && isInputDirection && (
            <PayInfo
              label="You'll receive:"
              amount={formattedReceive}
              currency={dstCurrency}
              chainName={dstChainName}
              amountUsd={outputUsd}
              showFadedAmount={!hasReceiveAmount}
            />
          )}
          {route && <RouteSection route={route} />}
        </div>
      </div>
    </div>
  )
}
