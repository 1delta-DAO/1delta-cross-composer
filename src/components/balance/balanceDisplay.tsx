import { CurrencyHandler, getWNative, type RawCurrency } from '@1delta/lib-utils'
import { InputTokenSelector } from '../actions/shared/InputTokenSelector'
import { useConnection } from 'wagmi'
import { useBalanceQuery } from '../../hooks/balances/useBalanceQuery'
import { PricesRecord } from '../../hooks/prices/usePriceQuery'

interface Props {
  srcCurrency?: RawCurrency
  onSrcCurrencyChange?: (c: RawCurrency) => void
  pricesData?: PricesRecord
}

export default function BalanceDisplay({ srcCurrency, onSrcCurrencyChange, pricesData }: Props) {
  const { address } = useConnection()
  const { data: inputBalances, isLoading } = useBalanceQuery({
    currencies: srcCurrency ? [srcCurrency, getWNative(srcCurrency.chainId)] : [],
    enabled: srcCurrency && Boolean(address),
  })

  const chainId = srcCurrency?.chainId ?? ''
  const tokenAddr = srcCurrency?.address ?? ''
  const balObj = inputBalances?.[chainId]?.[tokenAddr]
  const formatted = balObj ? CurrencyHandler.toSignificant(balObj.amount, 6) : null

  const usdPrice = pricesData?.[chainId]?.[tokenAddr]?.usd
  const usdValue =
    formatted && usdPrice
      ? (Number(formatted) * usdPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : null

  return (
    <div className="w-full">
      <div className="card bg-base-100 border border-base-300 shadow-sm rounded-2xl">
        <div className="card-body p-4 flex flex-row items-center justify-between gap-6">
          <div className="flex flex-col justify-center w-32">
            <div className="text-[12px] tracking-wide opacity-60">Your Balance</div>
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-t-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            ) : (
              <div className="flex flex-row items-baseline gap-2">
                <div className="text-xl font-semibold leading-tight">{formatted ?? '0.0'}</div>
                {usdValue !== null && <div className="text-xs opacity-50 mt-0.5">${usdValue}</div>}
              </div>
            )}
          </div>

          {onSrcCurrencyChange && (
            <div className="flex items-center">
              <InputTokenSelector
                srcCurrency={srcCurrency}
                onCurrencyChange={onSrcCurrencyChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
