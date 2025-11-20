import type { Address } from "viem"
import { Logo } from "../common/Logo"
import { filterNumeric, getTokenPrice } from "./swapUtils"
import type { RawCurrency, RawCurrencyAmount } from "../../types/currency"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"

type TokenInputSectionProps = {
  amount: string
  onAmountChange: (value: string) => void
  srcCurrency?: RawCurrency
  srcTokenBalance?: RawCurrencyAmount
  srcBalances?: Record<string, Record<string, { value?: string }>>
  srcPricesMerged?: Record<string, { usd: number }>
  lists?: Record<string, Record<string, any>>
  onTokenClick: () => void
  onReset?: () => void
  onPercentageClick?: (percentage: number) => void
}

export function TokenInputSection({
  amount,
  onAmountChange,
  srcCurrency,
  srcTokenBalance,
  srcBalances,
  srcPricesMerged,
  lists,
  onTokenClick,
  onReset,
  onPercentageClick,
}: TokenInputSectionProps) {
  const srcToken = srcCurrency?.address as Address | undefined
  const srcChainId = srcCurrency?.chainId

  const balance = srcTokenBalance
    ? CurrencyHandler.toExactNumber(srcTokenBalance).toString()
    : srcToken && srcChainId
      ? srcBalances?.[srcChainId]?.[srcToken.toLowerCase()]?.value
      : undefined

  const price = srcToken && srcChainId ? getTokenPrice(srcChainId, srcToken, srcPricesMerged) : undefined
  const usd = price && amount ? Number(amount) * price : undefined

  return (
    <div className="rounded-2xl bg-base-200 p-4 shadow border border-base-300 relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm opacity-70">Sell</div>
          {onReset && (
            <button type="button" className="btn btn-xs btn-ghost" onClick={onReset} title="Reset form">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
        {onPercentageClick && (
          <div className="absolute right-4 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <div className="join">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  className="btn btn-xs join-item"
                  onClick={() => {
                    const n = balance ? Number(balance) : 0
                    onAmountChange(n > 0 ? ((n * p) / 100).toString() : "")
                  }}
                >
                  {p === 100 ? "Max" : `${p}%`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1">
        <input
          className="input input-ghost text-4xl font-semibold flex-1 text-left border-0 focus:outline-none bg-transparent focus:bg-transparent p-0"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmountChange(filterNumeric(e.target.value))}
          placeholder="0"
        />
        <div>
          <button className="btn btn-outline rounded-2xl flex items-center gap-2 border-[0.5px]" onClick={onTokenClick}>
            {srcCurrency ? (
              <>
                <Logo
                  src={srcToken && srcChainId ? lists?.[srcChainId]?.[srcToken.toLowerCase()]?.logoURI : undefined}
                  alt={srcCurrency.symbol || "Token"}
                  size={20}
                  fallbackText={srcCurrency.symbol?.[0] || "T"}
                />
                <span>{srcCurrency.symbol || "Token"}</span>
              </>
            ) : (
              <span>Select token</span>
            )}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mt-2">
        <div className="opacity-70">{usd !== undefined ? `$${usd.toFixed(2)}` : "$0"}</div>
        <div className={balance && amount && Number(amount) > Number(balance) ? "text-error" : "opacity-70"}>
          {balance ? `${Number(balance).toFixed(4)} ${srcCurrency?.symbol || ""}` : ""}
        </div>
      </div>
    </div>
  )
}
