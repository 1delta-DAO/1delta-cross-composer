import ReverseActionSelector from '../ReverseActionSelector'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { ActionHandler } from '../actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import { CurrencyHandler } from '@1delta/lib-utils'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'
import { TransactionSummary } from '../transactionSummary/TransactionSummary'
import { initialState, UnifiedState } from '../ActionSelector'
import { useMemo, useState } from 'react'

type ReverseActionsPanelProps = {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  currentChainId: number
  setActionInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  onDstCurrencyChange: (currency: RawCurrency) => void
  calculatedInputAmount?: string
  actionInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
  resetKey?: number
  pricesData?: PricesRecord
  isLoadingPrices?: boolean
  isFetchingPrices?: boolean
}

export function ReverseActionsPanel({
  srcCurrency,
  dstCurrency,
  setActionInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  onDstCurrencyChange,
  calculatedInputAmount,
  actionInfo,
  resetKey,
  pricesData,
  isLoadingPrices,
  isFetchingPrices,
}: ReverseActionsPanelProps) {
  const [state, setState] = useState<UnifiedState>(initialState)
  const quoteOutputAmount = useMemo(() => {
    const idx = selectedQuoteIndex ?? 0
    const tradeOut = quotes?.[idx]?.trade?.outputAmount
    if (!tradeOut) return undefined
    try {
      return CurrencyHandler.toExact(tradeOut)
    } catch {
      return undefined
    }
  }, [quotes, selectedQuoteIndex])
  return (
    <>
      <ReverseActionSelector
        state={state}
        setState={setState}
        pricesData={pricesData}
        resetKey={resetKey}
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        setActionInfo={setActionInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={setSelectedQuoteIndex}
        slippage={slippage}
        onDstCurrencyChange={onDstCurrencyChange}
        actionInfo={actionInfo}
      />

      <TransactionSummary
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        inputAmount={calculatedInputAmount}
        outputAmount={quoteOutputAmount}
        currencyAmount={actionInfo?.currencyAmount}
        inputActionLabel={actionInfo?.actionLabel}
        isReverseFlow={true}
        pricesData={pricesData}
        isLoadingPrices={isLoadingPrices}
        isFetchingPrices={isFetchingPrices}
        state={state}
      />
    </>
  )
}
