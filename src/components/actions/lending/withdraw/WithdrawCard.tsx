import type { MoonwellMarket } from '../shared/marketCache'
import { RawCurrency } from '../../../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils'

type MarketTokenCardProps = {
  market: MoonwellMarket
  onActionClick: () => void
  currencyFromList: RawCurrency
  underlyingCurrency: RawCurrency
  enteredAmount?: string
  balance: bigint
  balanceOfUnderlying: bigint
}

function WithdrawCard({
  market,
  onActionClick,
  currencyFromList,
  underlyingCurrency,
  enteredAmount,
  balance,
  balanceOfUnderlying,
}: MarketTokenCardProps) {
  const token = currencyFromList
  const symbol = market.symbol || token?.symbol || 'Unknown'

  const iconSrc = currencyFromList.logoURI

  const isSelected =
    enteredAmount !== undefined && enteredAmount.trim() !== '' && Number(enteredAmount) > 0

  const borderClass = isSelected
    ? 'border-2 border-primary'
    : 'border border-base-300 hover:border-primary/50'

  const balanceFormatted = CurrencyHandler.toSignificant(
    CurrencyHandler.fromRawAmount(currencyFromList, balanceOfUnderlying)
  )
  return (
    <button
      type="button"
      className={`flex flex-col items-center gap-1 p-3 cursor-pointer rounded-lg ${borderClass} bg-base-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      disabled={market.borrowPaused}
      onClick={() => {
        if (!market.borrowPaused) onActionClick()
      }}
      title={market.borrowPaused ? 'Unavailable' : symbol}
    >
      <div className="h-12 w-12 rounded-full bg-base-200 flex items-center justify-center overflow-hidden shrink-0">
        {iconSrc ? (
          <img src={iconSrc} alt={symbol} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold">{symbol.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <span className="text-xs font-medium truncate w-full text-center">{symbol}</span>
      <span className="block text-[9px] text-base-content/60">{token.name}</span>

      {/* Balance */}
      <div className="text-center">
        <span className="block text-[11px] text-base-content/60">Balance</span>
        <span className="text-xs font-medium tabular-nums">{balanceFormatted}</span>
      </div>
    </button>
  )
}

export { WithdrawCard }
