import type { MoonwellMarket } from './marketCache'
import { RawCurrency } from '../../../../types/currency'

type MarketTokenCardProps = {
  market: MoonwellMarket
  onActionClick: () => void
  currencyFromList: RawCurrency
  underlyingCurrency: RawCurrency
  enteredAmount?: string
}

function DepositCard({
  market,
  onActionClick,
  currencyFromList,
  underlyingCurrency,
  enteredAmount,
}: MarketTokenCardProps) {
  const token = currencyFromList

  const symbol = market.symbol || token?.symbol || 'Unknown'

  const iconSrc = currencyFromList.logoURI

  const isSelected =
    enteredAmount !== undefined && enteredAmount.trim() !== '' && Number(enteredAmount) > 0

  const borderClass = isSelected
    ? 'border-2 border-primary'
    : 'border border-base-300 hover:border-primary/50'

  return (
    <button
      type="button"
      className={`flex flex-col items-center gap-2 p-3 cursor-pointer rounded-lg ${borderClass} bg-base-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      disabled={market.mintPaused}
      onClick={() => {
        if (!market.mintPaused) onActionClick()
      }}
      title={market.mintPaused ? 'Unavailable' : symbol}
    >
      <div className="h-12 w-12 rounded-full bg-base-200 flex items-center justify-center overflow-hidden shrink-0">
        {iconSrc ? (
          <img src={iconSrc} alt={symbol} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold">{symbol.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <span className="text-xs font-medium truncate w-full text-center">{symbol}</span>
    </button>
  )
}

export { DepositCard }
