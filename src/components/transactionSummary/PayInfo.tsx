import React from 'react'
import { Logo } from '../common/Logo'
import { getChainLogo, RawCurrency } from '@1delta/lib-utils'
import { trimDecimals } from '../../lib/trimDecimal'

interface PayInfoProps {
  label?: string
  amount?: string
  currency?: RawCurrency
  chainName?: string
  amountUsd?: number
  showFadedAmount?: boolean
}

export function PayInfo({
  label = "You'll pay",
  amount,
  currency,
  chainName,
  amountUsd,
  showFadedAmount = false,
}: PayInfoProps) {
  const formattedUsd =
    amountUsd !== undefined && isFinite(amountUsd) ? `$${amountUsd.toFixed(2)}` : undefined

  const chainLogo = getChainLogo(currency?.chainId)

  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-base-100 border border-base-300">
      {/* Label */}
      <span className="text-sm font-semibold opacity-70">{label}</span>

      {/* Main row */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {currency?.logoURI && (
            <Logo
              src={currency?.logoURI}
              alt={currency?.symbol!}
              className="h-6 w-6 rounded-full"
              fallbackText={currency?.symbol}
            />
          )}

          {/* Amount + symbol */}
          <span className={`text-lg font-medium ${showFadedAmount ? 'opacity-50' : ''}`}>
            {trimDecimals(amount ?? '0', currency?.decimals ?? 18)} {currency?.symbol}
          </span>
          {/* Chain info row */}
          {chainName && (
            <div className="flex items-center gap-1 text-xs opacity-70">
              <span>on {chainName}</span>
              {chainLogo && (
                <Logo
                  src={chainLogo}
                  alt={chainName}
                  className="h-4 w-4 rounded-full"
                  fallbackText={chainName[0]}
                />
              )}
            </div>
          )}
        </div>

        {/* USD value */}
        {formattedUsd && <div className="text-xs opacity-70">≈ {formattedUsd} USD</div>}
      </div>
    </div>
  )
}
