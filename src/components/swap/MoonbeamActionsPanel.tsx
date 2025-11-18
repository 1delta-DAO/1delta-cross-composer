import { useState } from "react"
import type { Address, Hex } from "viem"
import { encodeFunctionData, parseUnits, maxUint256 } from "viem"
import { useSendTransaction, useSwitchChain } from "wagmi"
import { moonbeam } from "viem/chains"
import { SupportedChainId } from "../../sdk/types"
import DestinationActionSelector from "../DestinationActionSelector"
import type { DestinationActionConfig, DestinationCall } from "../../lib/types/destinationAction"
import { ERC20_ABI } from "../../lib/abi"
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
}

export function MoonbeamActionsPanel({
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
}: MoonbeamActionsPanelProps) {
    const { sendTransactionAsync: sendTestTransaction } = useSendTransaction()
    const [testTxHash, setTestTxHash] = useState<string | undefined>(undefined)
    const [testingDstCall, setTestingDstCall] = useState(false)
    const [editingAction, setEditingAction] = useState<PendingAction | null>(null)
    const [encodedActions, setEncodedActions] = useState<PendingAction[]>([])
    const { switchChainAsync } = useSwitchChain()
    const toast = useToast()

    if (dstChainId !== SupportedChainId.MOONBEAM) {
        return null
    }

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
                                        const { encodeDestinationActions } = await import("../../sdk/trade-helpers/destinationActions")
                                        const { encodeStellaDotStakingComposerCalldata } = await import("../../lib/trade-helpers/composerEncoding")
                                        const preCalls: DestinationCall[] = []
                                        const actionCalls: DestinationCall[] = []
                                        const composerActions: Array<{
                                            action: PendingAction
                                            composerCalldata: Hex
                                            composerAddress: Address
                                            gasLimit: bigint
                                        }> = []

                                        for (const a of actions) {
                                            const meta = (a.config as any)?.meta || {}
                                            const mTokenAddr = a.config.address as Address

                                            if (meta.useComposer) {
                                                const composerAddress = meta.composerAddress as Address
                                                const callForwarderAddress = meta.callForwarderAddress as Address
                                                const underlyingAddr = meta.underlying as Address

                                                if (!composerAddress || !callForwarderAddress || !underlyingAddr) {
                                                    throw new Error(`Missing required addresses for composer action: ${a.config.name}`)
                                                }

                                                const amountArg = a.args?.[0]
                                                if (!amountArg) {
                                                    throw new Error(`Missing amount argument for composer action: ${a.config.name}`)
                                                }

                                                const amount = BigInt(String(amountArg))

                                                // Approve composer for max DOT (staking token)
                                                const approveComposerCalldata = encodeFunctionData({
                                                    abi: ERC20_ABI,
                                                    functionName: "approve",
                                                    args: [composerAddress, maxUint256],
                                                })

                                                preCalls.push({
                                                    target: underlyingAddr,
                                                    value: 0n,
                                                    calldata: approveComposerCalldata as Hex,
                                                    gasLimit: BigInt(100000),
                                                })

                                                const composerCalldata = encodeStellaDotStakingComposerCalldata(
                                                    amount,
                                                    userAddress,
                                                    callForwarderAddress
                                                )

                                                const composerGasLimit = BigInt(500000)

                                                composerActions.push({
                                                    action: a,
                                                    composerCalldata,
                                                    composerAddress,
                                                    gasLimit: composerGasLimit,
                                                })

                                                continue
                                            }

                                            if (meta.preApproveFromUnderlying) {
                                                const underlyingAddr = (meta.underlying || "") as Address
                                                const idx = typeof meta.preApproveAmountArgIndex === "number" ? meta.preApproveAmountArgIndex : 0
                                                const amountArg = a.args?.[idx]
                                                if (underlyingAddr && amountArg !== undefined) {
                                                    try {
                                                        const approveCalldata = encodeFunctionData({
                                                            abi: ERC20_ABI,
                                                            functionName: "approve",
                                                            args: [mTokenAddr, BigInt(String(amountArg))],
                                                        })
                                                        preCalls.push({
                                                            target: underlyingAddr,
                                                            value: 0n,
                                                            calldata: approveCalldata as Hex,
                                                            gasLimit: BigInt(100000),
                                                        })
                                                    } catch {}
                                                }
                                            }
                                            if (a.config.group === "lending" && meta.enterMarketBefore) {
                                                try {
                                                    const { MOONWELL_COMPTROLLER } = await import("../../hooks/useMoonwellMarkets")
                                                    const enterData = encodeFunctionData({
                                                        abi: [
                                                            {
                                                                inputs: [{ internalType: "address[]", name: "cTokens", type: "address[]" }],
                                                                name: "enterMarkets",
                                                                outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
                                                                stateMutability: "nonpayable",
                                                                type: "function",
                                                            },
                                                        ] as any,
                                                        functionName: "enterMarkets",
                                                        args: [[mTokenAddr]],
                                                    })
                                                    preCalls.push({
                                                        target: MOONWELL_COMPTROLLER as Address,
                                                        value: 0n,
                                                        calldata: enterData as Hex,
                                                        gasLimit: BigInt(150000),
                                                    })
                                                } catch {}
                                            }
                                        }

                                        const regularActions = actions.filter((a) => !(a.config as any)?.meta?.useComposer)
                                        if (regularActions.length > 0) {
                                            const encoded = encodeDestinationActions(
                                                regularActions.map((a) => ({
                                                    config: a.config,
                                                    selector: a.selector,
                                                    args: a.args,
                                                    value: a.value ? parseUnits(a.value, 18) : 0n,
                                                }))
                                            )
                                            const regularActionCalls: DestinationCall[] = encoded.map((c) => ({
                                                target: c.target,
                                                value: c.value ?? 0n,
                                                calldata: c.calldata as Hex,
                                                gasLimit: BigInt(250000),
                                            }))
                                            actionCalls.push(...regularActionCalls)
                                        }

                                        // Add composer actions to actionCalls (as raw composer calldata, not permit-wrapped)
                                        for (const composerAction of composerActions) {
                                            actionCalls.push({
                                                target: composerAction.composerAddress,
                                                value: 0n,
                                                calldata: composerAction.composerCalldata,
                                                gasLimit: composerAction.gasLimit,
                                            })
                                        }

                                        const allCalls = [...preCalls, ...actionCalls]
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
                {destinationCalls.length > 0 && dstChainId && (
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
                                    : a
                            )
                        )
                        setEditingAction(null)
                    }}
                />
            )}
        </div>
    )
}
