import { useState, useMemo } from 'react'
import type { GenericTrade } from '../../sdk/types'
import { Logo } from '../common/Logo'
import type { RawCurrency } from '../../types/currency'
import { usePriceQuery } from '../../hooks/prices/usePriceQuery'

type QuoteSelectorProps = {
  quotes: Array<{ label: string; trade: GenericTrade }>
  selectedIndex: number
  onSelect: (index: number) => void
  amount: string
  srcSymbol: string
  dstSymbol: string
  dstCurrency?: RawCurrency
  quoting: boolean
  getLogo: (name: string) => string
}

export function QuoteSelector({
  quotes,
  selectedIndex,
  onSelect,
  amount,
  srcSymbol,
  dstSymbol,
  dstCurrency,
  quoting,
  getLogo,
}: QuoteSelectorProps) {
  const [expanded, setExpanded] = useState(false)

  if (quotes.length === 0) {
    return null
  }

  const selectedQuote = quotes[selectedIndex]
  const bestQuote = quotes[0]
  const bestOutput = bestQuote.trade.outputAmountRealized
  const selectedOutput = selectedQuote.trade.outputAmountRealized
  const selectedRate = amount && Number(amount) > 0 ? selectedOutput / Number(amount) : 0
  const { data: pricesData } = usePriceQuery({
    currencies: dstCurrency ? [dstCurrency] : [],
    enabled: Boolean(dstCurrency),
  })

  const dstPrice = useMemo(() => {
    if (!pricesData || !dstCurrency) return undefined
    return pricesData[dstCurrency.chainId]?.[dstCurrency.address.toLowerCase()]?.usd
  }, [pricesData, dstCurrency])

  return (
    <div className="rounded-2xl bg-base-200 p-4 shadow border border-base-300 mt-3">
      <div
        className="w-full p-3 rounded border border-base-300 hover:border-primary transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="text-sm font-medium flex items-center gap-2">
              {quoting && <span className="loading loading-spinner loading-xs" />}
              <span>{selectedQuote.label}</span>
            </div>
            <div className="text-xs opacity-60">
              1 {srcSymbol} = {selectedRate.toFixed(6)} {dstSymbol}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Logo
              src={getLogo(selectedQuote.label)}
              alt={selectedQuote.label}
              size={20}
              fallbackText={selectedQuote.label.slice(0, 2).toUpperCase()}
            />
            <span className="text-xs opacity-60">{expanded ? '▼' : '▶'}</span>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 max-h-[240px] overflow-y-auto">
          {quotes.map((q, idx) => {
            const output = q.trade.outputAmountRealized
            const rate = amount && Number(amount) > 0 ? output / Number(amount) : 0
            const isSelected = idx === selectedIndex
            const isBestQuote = idx === 0
            const diffPercent =
              bestOutput > 0 && idx > 0 ? ((output - bestOutput) / bestOutput) * 100 : 0
            const outputUsd = dstPrice ? output * dstPrice : undefined

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 hover:border-primary/50'
                }`}
                onClick={() => {
                  onSelect(idx)
                  setExpanded(false)
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Logo
                    src={getLogo(q.label)}
                    alt={q.label}
                    size={20}
                    fallbackText={q.label.slice(0, 2).toUpperCase()}
                  />
                  <div className="flex flex-col">
                    <div className="text-sm font-medium">
                      {output.toFixed(6)} {dstSymbol}
                    </div>
                    {outputUsd !== undefined && (
                      <div className="text-xs opacity-70">${outputUsd.toFixed(2)}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isBestQuote && <span className="badge badge-success text-xs">BEST</span>}
                  {diffPercent < 0 && (
                    <span className="text-xs text-error">{diffPercent.toFixed(2)}%</span>
                  )}
                  <div className="flex flex-col items-end">
                    <div className="text-sm font-medium">{q.label}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
