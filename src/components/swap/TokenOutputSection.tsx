import type { Address } from "viem"
import { Logo } from "../common/Logo"
import { getTokenPrice } from "./swapUtils"
import type { RawCurrency, RawCurrencyAmount } from "../../types/currency"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"

type TokenOutputSectionProps = {
  quoteOut?: string
  dstCurrency?: RawCurrency
  dstTokenBalance?: RawCurrencyAmount
  dstPricesMerged?: Record<string, { usd: number }>
  lists?: Record<string, Record<string, any>>
  onTokenClick: () => void
  slippage?: number
  quotes?: Array<{ label: string; trade: any }>
}

export function TokenOutputSection({
  quoteOut,
  dstCurrency,
  dstTokenBalance,
  dstPricesMerged,
  lists,
  onTokenClick,
  slippage,
  quotes,
}: TokenOutputSectionProps) {
  const dstToken = dstCurrency?.address as Address | undefined
  const dstChainId = dstCurrency?.chainId

  const price = dstToken && dstChainId ? getTokenPrice(dstChainId, dstToken, dstPricesMerged) : undefined
  const usd = price && quoteOut ? Number(quoteOut) * price : undefined

  return (
    <div className="rounded-2xl bg-base-200 p-4 shadow border border-base-300 relative group">
      <div className="text-sm opacity-70">Buy</div>
      <div className="flex items-center gap-3 mt-1">
        <div className="text-4xl font-semibold flex-1 text-left">{quoteOut ?? "0"}</div>
        <div>
          <button className="btn btn-outline rounded-2xl flex items-center gap-2 border-[0.5px]" onClick={onTokenClick}>
            {dstCurrency ? (
              <>
                <Logo
                  src={dstToken && dstChainId ? lists?.[dstChainId]?.[dstToken.toLowerCase()]?.logoURI : undefined}
                  alt={dstCurrency.symbol || "Token"}
                  size={20}
                  fallbackText={dstCurrency.symbol?.[0] || "T"}
                />
                <span>{dstCurrency.symbol || "Token"}</span>
              </>
            ) : (
              <span>Select token</span>
            )}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mt-2">
        <div className="opacity-70">{usd !== undefined ? `$${usd.toFixed(2)}` : "$0"}</div>
        <div className="opacity-70">
          {dstTokenBalance ? `${CurrencyHandler.toExactNumber(dstTokenBalance).toFixed(4)} ${dstCurrency?.symbol || ""}` : ""}
        </div>
      </div>
      {quotes && quotes.length > 0 && slippage !== undefined && (
        <div className="flex items-center justify-between text-xs mt-1 opacity-60">
          <span>Max slippage</span>
          <span>{slippage.toFixed(2)}%</span>
        </div>
      )}
    </div>
  )
}
