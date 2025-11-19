import { useState } from "react"
import type { Address, Hex } from "viem"
import { parseUnits } from "viem"
import { useSendTransaction, useSwitchChain } from "wagmi"
import { moonbeam } from "viem/chains"
import { SupportedChainId } from "../../sdk/types"
import DestinationActionSelector from "../DestinationActionSelector"
import type { DestinationActionConfig, DestinationCall } from "../../lib/types/destinationAction"
import { useToast } from "../common/ToastHost"
import { ActionsList } from "../ActionsList"
import { LendingActionModal } from "../LendingActionModal"

type PendingAction = {
  id: string
  config: DestinationActionConfig
  selector: Hex
  args: any[]
  value?: string
}

type MoonbeamActionsPanelProps = {
  dstChainId?: string
  dstToken?: Address
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
}

export function ActionsPanel({
  dstChainId,
  dstToken,
  userAddress,
  currentChainId,
  isEncoding,
  setIsEncoding,
  destinationCalls,
  setDestinationCalls,
  actions,
  setActions,
  onRefreshQuotes,
  tokenLists,
}: MoonbeamActionsPanelProps) {
  const { sendTransactionAsync: sendTestTransaction } = useSendTransaction()
  const [testTxHash, setTestTxHash] = useState<string | undefined>(undefined)
  const [testingDstCall, setTestingDstCall] = useState(false)
  const [editingAction, setEditingAction] = useState<PendingAction | null>(null)
  const [encodedActions, setEncodedActions] = useState<PendingAction[]>([])
  const { switchChainAsync } = useSwitchChain()
  const toast = useToast()

  return (
    <div className="card bg-base-200 shadow-lg border border-primary/30 mt-4">
      <div className="card-body">
        <div className="font-medium mb-3">Destination Actions</div>
        {encodedActions.length === 0 ? (
          <>
            <DestinationActionSelector
              dstToken={dstToken}
              dstChainId={dstChainId}
              userAddress={userAddress}
              tokenLists={tokenLists}
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
            <div className="text-sm font-semibold opacity-70">Encoded Actions ({encodedActions.length})</div>
            <ActionsList actions={encodedActions} />
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
        )}
        {encodedActions.length === 0 && actions.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-center">
              <button
                className="btn btn-success"
                disabled={isEncoding}
                onClick={async () => {
                  try {
                    if (!userAddress) return
                    setIsEncoding(true)
                    const { encodeDestinationActions } = await import("../../lib/trade-helpers/destinationActions")

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
                            gasLimit: 600000n,
                          })
                        }
                      } else {
                        const encoded = encodeDestinationActions([
                          {
                            config: cfg,
                            selector: a.selector,
                            args: a.args,
                            value: ctxValue,
                          },
                        ])

                        for (const c of encoded) {
                          allCalls.push({
                            target: c.target,
                            value: c.value ?? 0n,
                            calldata: c.calldata as Hex,
                            gasLimit: 600000n,
                          })
                        }
                      }
                    }

                    setDestinationCalls(allCalls)
                    setEncodedActions(actions)
                    onRefreshQuotes()
                  } catch (e) {
                    console.error("Failed to encode destination calls:", e)
                    toast.showError("Failed to encode destination calls")
                  } finally {
                    setIsEncoding(false)
                  }
                }}
              >
                Encode
              </button>
            </div>
          </div>
        )}
        {destinationCalls.length > 0 && dstChainId === SupportedChainId.MOONBEAM && (
          <div className="mt-3 p-3 rounded border border-base-300">
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-70">Destination composed call tester</div>
              <button
                className={`btn btn-sm ${testingDstCall ? "btn-disabled" : "btn-outline"}`}
                onClick={async () => {
                  if (!dstChainId) return
                  try {
                    setIsEncoding(true)
                    setTestingDstCall(true)
                    setTestTxHash(undefined)
                    if (Number(currentChainId) !== moonbeam.id) {
                      await switchChainAsync({ chainId: moonbeam.id })
                    }

                    let lastHash: Hex | undefined
                    for (const call of destinationCalls) {
                      const txHash = await sendTestTransaction({
                        to: call.target,
                        data: call.calldata,
                        value: (call.value ?? 0n) as any,
                      })
                      lastHash = txHash as any
                    }
                    if (lastHash) {
                      setTestTxHash(lastHash as any)
                    }
                  } catch (e: any) {
                    toast.showError(e?.message || "Failed to send destination call")
                  } finally {
                    setTestingDstCall(false)
                    setIsEncoding(false)
                  }
                }}
              >
                {testingDstCall ? "Sending..." : "Test destination call"}
              </button>
            </div>
            {testTxHash && (
              <div className="mt-2 text-xs">
                <div>Tx: {testTxHash}</div>
              </div>
            )}
          </div>
        )}
      </div>
      {editingAction && (
        <LendingActionModal
          open={editingAction !== null}
          onClose={() => setEditingAction(null)}
          actionConfig={editingAction.config}
          selector={editingAction.selector}
          initialArgs={editingAction.args}
          initialValue={editingAction.value}
          userAddress={userAddress}
          chainId={dstChainId}
          onConfirm={(config, selector, args, value) => {
            setActions((arr) =>
              arr.map((a) =>
                a.id === editingAction.id
                  ? {
                      ...a,
                      config,
                      selector,
                      args: args || [],
                      value: value,
                    }
                  : a,
              ),
            )
            setEditingAction(null)
          }}
        />
      )}
    </div>
  )
}
