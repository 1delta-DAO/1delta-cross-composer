import { useTokenLists } from '../../../../hooks/useTokenLists'
import type { MoonwellMarket } from '../../../../lib/moonwell/marketCache'
import { RawCurrency } from '../../../../types/currency'

type MarketTokenCardProps = {
  market: MoonwellMarket
  onActionClick: () => void
  currencyFromList: RawCurrency
}

function DepositCard({ market, onActionClick, currencyFromList }: MarketTokenCardProps) {
  const token = currencyFromList

  const symbol = market.symbol || token?.symbol || 'Unknown'

  const name = token?.name || symbol

  const iconSrc = currencyFromList.logoURI

  return (
    <div className="card bg-base-100 border border-base-300 hover:border-primary/50 transition-colors">
      <div className="card-body p-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: token icon + text */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-base-200 flex items-center justify-center overflow-hidden shrink-0">
              {iconSrc ? (
                <img src={iconSrc} alt={symbol} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold">{symbol.slice(0, 3).toUpperCase()}</span>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm truncate">{symbol}</span>
              {name && <span className="text-xs text-base-content/60 truncate">{name}</span>}
            </div>
          </div>

          {/* Right: action button */}
          <button
            className="btn btn-xs btn-primary"
            disabled={market.mintPaused}
            onClick={(e) => {
              e.stopPropagation()
              if (!market.mintPaused) onActionClick()
            }}
          >
            {market.mintPaused ? 'Unavailable' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  )
}

export { DepositCard }
