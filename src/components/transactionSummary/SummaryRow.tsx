import React from 'react'

interface SummaryRowProps {
  label: string
  amount?: string
  currencySymbol?: string
  chainName?: string
  amountUsd?: number | undefined
  showFadedAmount?: boolean
  destinationActionLabel?: string
}

export function SummaryRow({
  label,
  amount,
  currencySymbol,
  chainName,
  amountUsd,
  showFadedAmount = false,
  destinationActionLabel,
}: SummaryRowProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm opacity-70">{label}</span>
        <span className="font-medium">
          {showFadedAmount ? (
            <span className="opacity-60">{amount}</span>
          ) : (
            <>
              {amount} {currencySymbol}
              {destinationActionLabel && (
                <span className="ml-1 opacity-80">→ {destinationActionLabel}</span>
              )}
            </>
          )}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs opacity-50"></span>
        <div className="text-xs opacity-60">
          {amountUsd !== undefined && isFinite(amountUsd) ? `$${amountUsd.toFixed(2)}` : ''}
          {chainName && <span className="ml-2">({chainName})</span>}
        </div>
      </div>
    </div>
  )
}
