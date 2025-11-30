import ActionSelector from '../ActionSelector'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { ActionHandler } from '../actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import { TransactionSummary } from '../actions/shared/TransactionSummary'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'

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
}: ActionsPanelProps) {
  const { data: chains } = useChainsRegistry()

  return (
    <>
      <ActionSelector
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
        chains={chains}
      />
    </>
  )
}
