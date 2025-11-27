import DestinationActionSelector from '../DestinationActionSelector'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { DestinationActionHandler } from '../actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import { TransactionSummary } from '../actions/shared/TransactionSummary'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'

type ActionsPanelProps = {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  currentChainId: number
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: DestinationActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  onSrcCurrencyChange: (currency: RawCurrency) => void
  calculatedInputAmount?: string
  destinationInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string }
  isRequoting?: boolean
  resetKey?: number
}

export function ActionsPanel({
  srcCurrency,
  dstCurrency,
  tokenLists,
  setDestinationInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  onSrcCurrencyChange,
  calculatedInputAmount,
  destinationInfo,
  isRequoting,
  resetKey,
}: ActionsPanelProps) {
  const { data: chains } = useChainsRegistry()

  return (
    <div className="card bg-base-200 shadow-lg border border-primary/30 mt-4">
      <div className="card-body">
        <DestinationActionSelector
          resetKey={resetKey}
          srcCurrency={srcCurrency}
          dstCurrency={dstCurrency}
          tokenLists={tokenLists}
          setDestinationInfo={setDestinationInfo}
          quotes={quotes}
          selectedQuoteIndex={selectedQuoteIndex}
          setSelectedQuoteIndex={setSelectedQuoteIndex}
          slippage={slippage}
          onSrcCurrencyChange={onSrcCurrencyChange}
          destinationInfo={destinationInfo}
          isRequoting={isRequoting}
        />

        <TransactionSummary
          srcCurrency={srcCurrency}
          dstCurrency={dstCurrency}
          inputAmount={calculatedInputAmount}
          currencyAmount={destinationInfo?.currencyAmount}
          destinationActionLabel={destinationInfo?.actionLabel}
          isRequoting={isRequoting}
          chains={chains}
        />
      </div>
    </div>
  )
}
