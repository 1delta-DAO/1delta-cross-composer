import ReverseActionSelector from '../ReverseActionSelector'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { ActionHandler } from '../actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import { TransactionSummary } from '../actions/shared/TransactionSummary'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'

type ReverseActionsPanelProps = {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  currentChainId: number
  setInputInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  onDstCurrencyChange: (currency: RawCurrency) => void
  calculatedInputAmount?: string
  inputInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
  resetKey?: number
  pricesData?: PricesRecord
  isLoadingPrices?: boolean
  isFetchingPrices?: boolean
}

export function ReverseActionsPanel({
  srcCurrency,
  dstCurrency,
  setInputInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  onDstCurrencyChange,
  calculatedInputAmount,
  inputInfo,
  resetKey,
  pricesData,
  isLoadingPrices,
  isFetchingPrices,
}: ReverseActionsPanelProps) {
  const { data: chains } = useChainsRegistry()

  return (
    <>
      <ReverseActionSelector
        resetKey={resetKey}
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        setInputInfo={setInputInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={setSelectedQuoteIndex}
        slippage={slippage}
        onDstCurrencyChange={onDstCurrencyChange}
        inputInfo={inputInfo}
      />

      <TransactionSummary
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        inputAmount={calculatedInputAmount}
        currencyAmount={inputInfo?.currencyAmount}
        inputActionLabel={inputInfo?.actionLabel}
        isReverseFlow={true}
        chains={chains}
        pricesData={pricesData}
        isLoadingPrices={isLoadingPrices}
        isFetchingPrices={isFetchingPrices}
      />
    </>
  )
}
