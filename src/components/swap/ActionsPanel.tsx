import { useState, useMemo } from "react"
import type { Address, Hex } from "viem"
import { parseUnits } from "viem"
import DestinationActionSelector from "../DestinationActionSelector"
import type { DestinationActionConfig, DestinationCall } from "../../lib/types/destinationAction"
import type { RawCurrency, RawCurrencyAmount } from "../../types/currency"
import { useToast } from "../common/ToastHost"
import { ActionsList } from "../ActionsList"

type PendingAction = {
  id: string
  config: DestinationActionConfig
  selector: Hex
  args: any[]
  value?: string
}

type ActionsPanelProps = {
  dstCurrency?: RawCurrency
  userAddress?: Address
  currentChainId: number
  isEncoding: boolean
  setIsEncoding: (value: boolean) => void
  destinationCalls: DestinationCall[]
  setDestinationCalls: (value: DestinationCall[]) => void
  actions: PendingAction[]
  setActions: React.Dispatch<React.SetStateAction<PendingAction[]>>
  onRefreshQuotes: () => void
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: (amount: RawCurrencyAmount | undefined) => void
}

export function ActionsPanel({
  dstCurrency,
  userAddress,
  isEncoding,
  setIsEncoding,
  setDestinationCalls,
  actions,
  setActions,
  onRefreshQuotes,
  tokenLists,
  setDestinationInfo,
}: ActionsPanelProps) {
  const [editingAction, setEditingAction] = useState<PendingAction | null>(null)
  const [encodedActions, setEncodedActions] = useState<PendingAction[]>([])
  const toast = useToast()

  const dstChainId = useMemo(() => dstCurrency?.chainId, [dstCurrency])
  const dstToken = useMemo(() => dstCurrency?.address as Address | undefined, [dstCurrency])

  const handleEncodeClick = async () => {
    try {
      if (!userAddress) return
      setIsEncoding(true)
      const allCalls: DestinationCall[] = []

      for (const a of actions) {
        const cfg = a.config as DestinationActionConfig
        const hasBuilder = typeof cfg.buildCalls === "function"
        const ctxValue = a.value ? parseUnits(a.value, 18) : 0n

        if (hasBuilder && cfg.buildCalls) {
          const encoded = await cfg.buildCalls({
            userAddress,
            dstChainId,
            selector: a.selector,
            args: a.args,
            value: ctxValue,
          })

          for (const c of encoded) {
            allCalls.push({
              target: c.target,
              value: c.value ?? 0n,
              calldata: c.calldata as Hex,
              callType: c.callType,
              balanceOfInjectIndex: c.balanceOfInjectIndex,
              tokenAddress: c.tokenAddress,
              gasLimit: 600000n,
            })
          }
        }
      }

      setDestinationCalls(allCalls)
      console.log("allCalls", allCalls)
      setEncodedActions(actions)
      onRefreshQuotes()
    } catch (e) {
      console.error("Failed to encode destination calls:", e)
      toast.showError("Failed to encode destination calls")
    } finally {
      setIsEncoding(false)
    }
  }

  return (
    <div className="card bg-base-200 shadow-lg border border-primary/30 mt-4">
      <div className="card-body">
        <div className="font-medium mb-3">Destination Actions</div>
        {encodedActions.length === 0 ? (
          <>
            <DestinationActionSelector
              dstCurrency={dstCurrency}
              userAddress={userAddress}
              tokenLists={tokenLists}
              setDestinationInfo={setDestinationInfo}
              onAdd={(config, selector, args, value) => {
                setActions((arr) => [
                  ...arr,
                  {
                    id: Math.random().toString(36).slice(2),
                    config,
                    selector,
                    args: args || [],
                    value: value,
                  },
                ])
              }}
            />
            <ActionsList
              actions={actions}
              onRemove={(id) => setActions((arr) => arr.filter((x) => x.id !== id))}
              onMoveUp={(id) => {
                setActions((arr) => {
                  const copy = [...arr]
                  const i = copy.findIndex((x) => x.id === id)
                  if (i > 0) {
                    const tmp = copy[i - 1]
                    copy[i - 1] = copy[i]
                    copy[i] = tmp
                  }
                  return copy
                })
              }}
              onMoveDown={(id) => {
                setActions((arr) => {
                  const copy = [...arr]
                  const i = copy.findIndex((x) => x.id === id)
                  if (i >= 0 && i < copy.length - 1) {
                    const tmp = copy[i + 1]
                    copy[i + 1] = copy[i]
                    copy[i] = tmp
                  }
                  return copy
                })
              }}
              onEdit={(action) => setEditingAction(action)}
            />
          </>
        ) : (
          <div className="space-y-2">
            <ActionsList actions={encodedActions} />
            <div className="flex justify-center">
              <button
                className="btn btn-xs btn-outline"
                type="button"
                onClick={() => {
                  setEncodedActions([])
                  setDestinationCalls([])
                  onRefreshQuotes()
                }}
              >
                Clear encoded actions
              </button>
            </div>
          </div>
        )}
        {encodedActions.length === 0 && actions.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-center">
              <button className="btn btn-success" disabled={isEncoding} onClick={handleEncodeClick}>
                Encode
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
