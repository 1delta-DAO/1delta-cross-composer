import ActionSelector, { initialState, UnifiedState } from '../ActionSelector'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { ActionHandler } from '../actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import { TransactionSummary } from '../transactionSummary/TransactionSummary'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'
import { useState } from 'react'

/* -------------------------------------------------------------------------- */
/*                            UNIFIED STATE SHAPE                             */
/* -------------------------------------------------------------------------- */

type ActionsPanelProps = {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  currentChainId: number
  setDestinationInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  onSrcCurrencyChange: (currency: RawCurrency) => void
  calculatedInputAmount?: string
  destinationInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string }
  resetKey?: number
  pricesData?: PricesRecord
  isLoadingPrices?: boolean
  isFetchingPrices?: boolean
}

export function ActionsPanel({
  srcCurrency,
  dstCurrency,
  setDestinationInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  onSrcCurrencyChange,
  calculatedInputAmount,
  destinationInfo,
  resetKey,
  pricesData,
  isLoadingPrices,
  isFetchingPrices,
}: ActionsPanelProps) {
  /** selection state */
  const [state, setState] = useState<UnifiedState>(initialState)

  return (
    <>
      <ActionSelector
        state={state}
        setState={setState}
        pricesData={pricesData}
        resetKey={resetKey}
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        setDestinationInfo={setDestinationInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={setSelectedQuoteIndex}
        slippage={slippage}
        onSrcCurrencyChange={onSrcCurrencyChange}
        destinationInfo={destinationInfo}
      />

      <TransactionSummary
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        inputAmount={calculatedInputAmount}
        currencyAmount={destinationInfo?.currencyAmount}
        destinationActionLabel={destinationInfo?.actionLabel}
        pricesData={pricesData}
        isLoadingPrices={isLoadingPrices}
        isFetchingPrices={isFetchingPrices}
        state={state}
      />
    </>
  )
}
