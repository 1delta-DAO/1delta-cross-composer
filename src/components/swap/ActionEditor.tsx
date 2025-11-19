import { useState, useEffect, useMemo } from "react"
import type { Abi, Hex } from "viem"
import { formatUnits, toFunctionSelector } from "viem"
import type { DestinationActionConfig } from "../../lib/types/destinationAction"

type ActionEditorProps = {
  action: { id: string; config: DestinationActionConfig; selector: Hex; args: any[]; value?: string }
  onChange: (a: { id: string; config: DestinationActionConfig; selector: Hex; args: any[]; value?: string }) => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
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
  return fns[0]
}

export function ActionEditor({ action, onChange, onRemove, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: ActionEditorProps) {
  const fnAbi = useMemo(() => findFunctionBySelector(action.config.abi as Abi, action.selector), [action])
  const [localArgs, setLocalArgs] = useState<any[]>(action.args ?? [])
  const [localValue, setLocalValue] = useState<string>(action.value ?? "")

  useEffect(() => {
    onChange({ ...action, args: localArgs, value: localValue })
  }, [localArgs, localValue])

  return (
    <div className="card bg-base-200">
      <div className="card-body gap-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">{action.config.name}</div>
          <div className="flex gap-2">
            {canMoveUp && (
              <button className="btn btn-xs" onClick={onMoveUp} aria-label="Move up">
                ↑
              </button>
            )}
            {canMoveDown && (
              <button className="btn btn-xs" onClick={onMoveDown} aria-label="Move down">
                ↓
              </button>
            )}
            <button className="btn btn-xs btn-error" onClick={onRemove} aria-label="Remove">
              Remove
            </button>
          </div>
        </div>
        {action.config.description && <div className="text-xs opacity-70">{action.config.description}</div>}
        {fnAbi ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {fnAbi.inputs?.map((inp: any, i: number) => (
              <div className="form-control" key={i}>
                <label className="label">
                  <span className="label-text">
                    {inp.name || `arg${i}`} ({inp.type})
                  </span>
                </label>
                <input
                  className="input input-bordered"
                  value={localArgs[i] ?? ""}
                  onChange={(e) =>
                    setLocalArgs((arr) => {
                      const copy = [...arr]
                      copy[i] = e.target.value
                      return copy
                    })
                  }
                  placeholder={inp.type}
                />
                {action.config.group === "lending" &&
                  inp.type === "uint256" &&
                  (() => {
                    const dec = (action.config as any).meta?.decimals
                    const raw = localArgs[i]
                    if (!dec || raw === undefined || raw === "") return null
                    try {
                      const bn = BigInt(String(raw))
                      const human = formatUnits(bn, dec)
                      const sym = (action.config as any).meta?.symbol || ""
                      return (
                        <span className="label-text-alt opacity-70">
                          {human} {sym}
                        </span>
                      )
                    } catch {
                      return null
                    }
                  })()}
              </div>
            ))}
            {fnAbi?.stateMutability === "payable" && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Value (ETH)</span>
                </label>
                <input
                  className="input input-bordered"
                  inputMode="decimal"
                  placeholder="0"
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm opacity-70">No ABI inputs found.</div>
        )}
      </div>
    </div>
  )
}
