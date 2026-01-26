import { useState } from 'react'
import type { Address } from 'viem'
import { parseUnits } from 'viem'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { ActionHandler } from '../../shared/types'
import { buildCalls } from './callBuilder'
import { MoonwellMarket } from '../shared/marketCache'
import { useAccount } from 'wagmi'
import { DUMMY_ADDRESS } from '../../../../lib/consts'
import { RawCurrency } from '../../../../types/currency'
import { Lender } from '@1delta/lib-utils'

type DepositActionModalProps = {
  open: boolean
  onClose: () => void
  market: MoonwellMarket
  selectedCurrency: RawCurrency
  userAddress?: Address
  chainId?: string
  setActionInfo?: ActionHandler
  amount?: string
  onAmountChange?: (amount: string) => void
}

export function DepositActionModal({
  open,
  onClose,
  market,
  selectedCurrency,
  setActionInfo,
  amount: externalAmount,
  onAmountChange,
}: DepositActionModalProps) {
  const [internalAmount, setInternalAmount] = useState<string>('')
  const { address } = useAccount()
  const userAddress = address ?? DUMMY_ADDRESS

  const amount = onAmountChange ? externalAmount || '' : internalAmount

  const handleAmountChange = (value: string) => {
    if (onAmountChange) {
      onAmountChange(value)
    } else {
      setInternalAmount(value)
    }
  }

  // Prefer selectedCurrency for UI + math; fall back to market.underlyingCurrency
  const underlying = selectedCurrency ?? market.underlyingCurrency

  const symbol = selectedCurrency?.symbol || market.underlyingCurrency?.symbol || ''

  const name = selectedCurrency?.name || symbol

  const iconSrc =
    // depending on RawCurrency shape
    (selectedCurrency as any)?.icon || (selectedCurrency as any)?.logoURI || undefined

  const mTokenSymbol = market.mTokenCurrency?.symbol || 'mToken'

  const handleConfirm = async () => {
    if (!amount || !underlying) return

    const currencyForCall = selectedCurrency || market.underlyingCurrency
    const destinationCalls = await buildCalls({
      amountHuman: amount,
      underlying: {
        ...market.underlyingCurrency,
        decimals: currencyForCall.decimals,
        chainId: currencyForCall.chainId,
      },
      userAddress: userAddress as any,
    })

    const parsedAmount = parseUnits(amount, underlying.decimals)
    setActionInfo?.(
      CurrencyHandler.fromRawAmount(underlying, parsedAmount),
      undefined,
      destinationCalls,
      `${mTokenSymbol} shares`,
      'moonwell_deposit',
      {
        lender: Lender.MOONWELL,
      }
    )

    onClose()
  }

  // Early return AFTER hooks
  if (!open) return null

  return (
    <div className={`modal ${open ? 'modal-open' : ''}`} onClick={onClose}>
      <div className="modal-box max-w-lg w-full rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-lg">Deposit</h3>
            <p className="text-xs text-base-content/60 mt-0.5">
              Deposit into Moonwell and receive {mTokenSymbol} shares.
            </p>
          </div>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={() => {
              setActionInfo?.(undefined, undefined, [])
              onClose()
            }}
          >
            ✕
          </button>
        </div>

        {/* Token summary */}
        <div className="mt-4 mb-5 rounded-xl border border-base-300 bg-base-200/40 px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-base-100 flex items-center justify-center overflow-hidden shrink-0">
              {iconSrc ? (
                <img src={iconSrc} alt={symbol || 'Token'} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold">
                  {(symbol || '?').slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{symbol || 'Select token'}</span>
              {name && <span className="text-xs text-base-content/60 truncate">{name}</span>}
            </div>
          </div>

          {underlying?.chainId && (
            <span className="badge badge-outline text-[0.7rem] px-2 py-1 whitespace-nowrap">
              Chain ID {underlying.chainId}
            </span>
          )}
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Amount input */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-sm font-medium">
                Amount {symbol && `(${symbol})`}
              </span>
            </label>
            <div className="input-group">
              <input
                className="input input-bordered w-full"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </div>

          {/* Footer / actions */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-base-300">
            <div className="text-[0.7rem] text-base-content/60">
              You&apos;ll receive <span className="font-medium">{mTokenSymbol}</span> shares
              representing your deposit.
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setActionInfo?.(undefined, undefined, [])
                  onClose()
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={!amount}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
