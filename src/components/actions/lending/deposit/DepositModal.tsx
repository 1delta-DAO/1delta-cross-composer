import { useState, useEffect, useMemo } from "react"
import type { Abi, Hex, Address } from "viem"
import { toFunctionSelector, parseUnits, formatUnits } from "viem"
import type { DestinationActionConfig } from "../../../../lib/types/destinationAction"
import type { RawCurrencyAmount } from "../../../../types/currency"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"
import { DestinationActionHandler } from "../../shared/types"
import { buildCalls } from "./callBuilder"
import { MoonwellMarket } from "../../../../hooks/useMoonwellMarkets"
import { getForwarderAddress } from "@1delta/lib-utils"
import { getComposerAddress } from "@1delta/calldata-sdk"

type DepositActionModalProps = {
  open: boolean
  onClose: () => void
  market: MoonwellMarket
  userAddress?: Address
  chainId?: string
  setDestinationInfo?: DestinationActionHandler
}

export function DepositActionModal({
  open,
  onClose,
  market,
  userAddress, // kept for API compatibility, unused for now
  setDestinationInfo,
}: DepositActionModalProps) {
  const [amount, setAmount] = useState<string>("")
  const underlying = market.underlyingCurrency

  const handleConfirm = async () => {
    const chainId = underlying.chainId
    const destinationCalls = await buildCalls({
      amountHuman: amount,
      underlying: market.underlyingCurrency,
      callForwarderAddress: getForwarderAddress(chainId)! as any,
      composerAddress: getComposerAddress(chainId)! as any,
      userAddress: userAddress as any,
    })
    // parse amount
    const am = parseUnits(amount, underlying.decimals)
    setDestinationInfo?.(CurrencyHandler.fromRawAmount(underlying, am), undefined, destinationCalls)

    onClose()
  }

  // Early return AFTER hooks
  if (!open) return null

  const symbol = underlying?.symbol || ""

  return (
    <div className={`modal ${open ? "modal-open" : ""}`} onClick={onClose}>
      <div className="modal-box max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{"Deposit"}</h3>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        {<div className="text-sm opacity-70 mb-4">Deposit to Moonwell</div>}

        <div className="space-y-4">
          {/* Amount input – the only real field we care about */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-sm font-medium">Amount {symbol && `(${symbol})`}</span>
            </label>
            <input
              className="input input-bordered w-full"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {underlying && <span className="label-text-alt opacity-60 mt-1">Token: {underlying.name}</span>}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-base-300">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
