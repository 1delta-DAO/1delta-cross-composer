import { useState, useEffect, useMemo } from "react"
import type { Abi, Hex, Address } from "viem"
import { toFunctionSelector } from "viem"
import type { DestinationActionConfig } from "../../../../lib/types/destinationAction"

type DepositActionModalProps = {
  open: boolean
  onClose: () => void
  actionConfig: DestinationActionConfig | null
  selector: Hex | null
  initialArgs?: any[]
  initialValue?: string
  userAddress?: Address
  chainId?: string
  onConfirm: (config: DestinationActionConfig, selector: Hex, args: any[], value?: string) => void
  setDestinationInfo?: (chainId: string, address: string, amount?: string) => void
}

function findFunctionBySelector(abi: Abi, selector: Hex): any {
  const fns = (abi as any[]).filter((it: any) => it?.type === "function")
  const lowerSel = selector.toLowerCase()
  for (const fn of fns) {
    try {
      const sel = toFunctionSelector(fn as any)
      if (sel.toLowerCase() === lowerSel) return fn
    } catch {}
  }
  // Fallback: first function
  return fns[0]
}

export function DepositActionModal({
  open,
  onClose,
  actionConfig,
  selector,
  initialArgs,
  initialValue,
  userAddress, // kept for API compatibility, unused for now
  chainId,
  onConfirm,
  setDestinationInfo,
}: DepositActionModalProps) {
  const [amount, setAmount] = useState<string>("")
  const [value, setValue] = useState<string>("")

  const fnAbi = useMemo(() => {
    if (!actionConfig || !selector) return null
    return findFunctionBySelector(actionConfig.abi as Abi, selector)
  }, [actionConfig, selector])

  // Just in case we still need to know where the amount should go in args
  const amountInputIndex = useMemo(() => {
    if (!fnAbi) return 0
    const inputs = fnAbi.inputs || []
    const idx = inputs.findIndex((inp: any) => inp.type === "uint256")
    return idx >= 0 ? idx : 0
  }, [fnAbi])

  // Pre-fill amount/value from initialArgs / initialValue if present
  useEffect(() => {
    if (open) {
      if (initialArgs && initialArgs.length > amountInputIndex) {
        const prev = initialArgs[amountInputIndex]
        setAmount(prev != null ? String(prev) : "")
      } else {
        setAmount("")
      }
      setValue(initialValue || "")
    } else {
      setAmount("")
      setValue("")
    }
  }, [open, initialArgs, initialValue, amountInputIndex])

  const handleConfirm = () => {
    if (!actionConfig || !selector) return

    // Hard-coded: we assume single "amount" arg at amountInputIndex
    const args: any[] = []
    args[amountInputIndex] = amount

    // Notify parent about destination info in a very explicit way
    const underlying = (actionConfig.meta as any)?.underlying as string | undefined
    if (setDestinationInfo && underlying) {
      setDestinationInfo(chainId || "", underlying, amount)
    }

    onConfirm(actionConfig, selector, args, value)
    onClose()
  }

  // Early return AFTER hooks
  if (!open || !actionConfig || !selector) return null

  const symbol = (actionConfig.meta as any)?.symbol || ""
  const underlying = (actionConfig.meta as any)?.underlying as string | undefined

  return (
    <div className={`modal ${open ? "modal-open" : ""}`} onClick={onClose}>
      <div className="modal-box max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{actionConfig.name || "Deposit"}</h3>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        {actionConfig.description && <div className="text-sm opacity-70 mb-4">{actionConfig.description}</div>}

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
            {underlying && <span className="label-text-alt opacity-60 mt-1">Token: {underlying}</span>}
          </div>

          {/* Optional payable value */}
          {fnAbi?.stateMutability === "payable" && (
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-sm font-medium">Value (ETH)</span>
              </label>
              <input
                className="input input-bordered w-full"
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-base-300">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>
              {initialArgs ? "Update Action" : "Add Action"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
