import { useState } from "react"
import type { Address, Hex } from "viem"
import { encodeFunctionData, parseUnits } from "viem"
import { useSendTransaction, useSignTypedData, useSwitchChain } from "wagmi"
import { moonbeam } from "viem/chains"
import { SupportedChainId } from "../../sdk/types"
import DestinationActionSelector from "../DestinationActionSelector"
import type { DestinationActionConfig } from "../../lib/types/destinationAction"
import { ERC20_ABI, CALL_PERMIT_ABI } from "../../lib/abi"
import { BATCH_PRECOMPILE, CALL_PERMIT_PRECOMPILE } from "../../lib/consts"
import { usePermitBatch } from "../../sdk/hooks/usePermitBatch"
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
    attachedMessage?: Hex
    setAttachedMessage: (value: Hex | undefined) => void
    attachedGasLimit?: bigint
    setAttachedGasLimit: (value: bigint | undefined) => void
    attachedValue?: bigint
    setAttachedValue: (value: bigint | undefined) => void
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
    attachedMessage,
    setAttachedMessage,
    attachedGasLimit,
    setAttachedGasLimit,
    attachedValue,
    setAttachedValue,
    actions,
    setActions,
    onRefreshQuotes,
}: MoonbeamActionsPanelProps) {
    const { sendTransactionAsync: sendTestTransaction } = useSendTransaction()
    const [testTxHash, setTestTxHash] = useState<string | undefined>(undefined)
    const [testingDstCall, setTestingDstCall] = useState(false)
    const [editingAction, setEditingAction] = useState<PendingAction | null>(null)
    const permitBatch = usePermitBatch()
    const { fetchNonce } = permitBatch
    const { signTypedDataAsync } = useSignTypedData()
    const { switchChainAsync } = useSwitchChain()
    const toast = useToast()

    if (dstChainId !== SupportedChainId.MOONBEAM) {
        return null
    }

    return (
        <div className="card bg-base-200 shadow-lg border border-primary/30 mt-4">
            <div className="card-body">
                <div className="font-medium mb-3">Destination Actions</div>
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
                {actions.length > 0 && (
                    <div className="mt-4 flex justify-center">
                        <button
                            className="btn btn-success"
                            disabled={isEncoding}
                            onClick={async () => {
                                try {
                                    if (!userAddress) return
                                    // Must sign with Moonbeam chain id for EIP712 domain
                                    setIsEncoding(true)
                                    if (Number(currentChainId) !== moonbeam.id) {
                                        try {
                                            await switchChainAsync({ chainId: moonbeam.id })
                                        } catch (e) {
                                            toast.showError("Please switch to Moonbeam to encode actions.")
                                            return
                                        }
                                    }
                                    // Build calls from actions
                                    const { encodeDestinationActions } = await import("../../sdk/trade-helpers/destinationActions")
                                    const preCalls: Array<{ target: Address; value: bigint; callData: Hex; gasLimit: bigint }> = []
                                    for (const a of actions) {
                                        const meta = (a.config as any)?.meta || {}
                                        const mTokenAddr = a.config.address as Address
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
                                                        callData: approveCalldata as Hex,
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
                                                    callData: enterData as Hex,
                                                    gasLimit: BigInt(150000),
                                                })
                                            } catch {}
                                        }
                                    }
                                    const encoded = encodeDestinationActions(
                                        actions.map((a) => ({
                                            config: a.config,
                                            selector: a.selector,
                                            args: a.args,
                                            value: a.value ? parseUnits(a.value, 18) : 0n,
                                        }))
                                    )
                                    const actionCalls = encoded.map((c) => ({
                                        target: c.target,
                                        value: c.value ?? 0n,
                                        callData: c.calldata as Hex,
                                        gasLimit: BigInt(250000),
                                    }))
                                    const calls = [...preCalls, ...actionCalls]
                                    // batch'em
                                    const batchData = permitBatch.createBatchData(calls as any)
                                    const gasLimit = BigInt(800000)
                                    const totalValue = calls.reduce((acc, c) => acc + (c.value ?? 0n), 0n)
                                    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30)
                                    const currentNonce = await fetchNonce(userAddress, moonbeam.id)
                                    if (currentNonce === null) {
                                        throw new Error("Failed to fetch nonce for permit")
                                    }
                                    // EIP712 sign
                                    const typedData = {
                                        domain: {
                                            name: "Call Permit Precompile",
                                            version: "1",
                                            chainId: moonbeam.id,
                                            verifyingContract: CALL_PERMIT_PRECOMPILE,
                                        },
                                        types: {
                                            CallPermit: [
                                                { name: "from", type: "address" },
                                                { name: "to", type: "address" },
                                                { name: "value", type: "uint256" },
                                                { name: "data", type: "bytes" },
                                                { name: "gaslimit", type: "uint64" },
                                                { name: "nonce", type: "uint256" },
                                                { name: "deadline", type: "uint256" },
                                            ],
                                        },
                                        primaryType: "CallPermit" as const,
                                        message: {
                                            from: userAddress,
                                            to: BATCH_PRECOMPILE,
                                            value: totalValue,
                                            data: batchData,
                                            gaslimit: gasLimit,
                                            nonce: currentNonce,
                                            deadline,
                                        },
                                    }
                                    const signature = await signTypedDataAsync(typedData as any)
                                    const sig = signature.slice(2)
                                    const r = `0x${sig.slice(0, 64)}` as Hex
                                    const s = `0x${sig.slice(64, 128)}` as Hex
                                    const v = parseInt(sig.slice(128, 130), 16)
                                    const message = encodeFunctionData({
                                        abi: CALL_PERMIT_ABI as any,
                                        functionName: "dispatch",
                                        args: [userAddress, BATCH_PRECOMPILE, totalValue, batchData, gasLimit, deadline, v, r, s],
                                    }) as Hex
                                    try {
                                        console.log("Signed destination actions (Moonbeam)", {
                                            calls: calls.map((c) => ({
                                                target: c.target,
                                                value: c.value.toString(),
                                                gasLimit: c.gasLimit.toString(),
                                                callData: `${(c.callData as string).slice(0, 18)}...`,
                                            })),
                                            batch: {
                                                gasLimit: gasLimit.toString(),
                                                deadline: Number(deadline),
                                                data: `${batchData.slice(0, 18)}...`,
                                            },
                                            signature: { v, r, s },
                                            message: `${message.slice(0, 18)}...`,
                                        })
                                    } catch {}
                                    setAttachedMessage(message)
                                    setAttachedGasLimit(gasLimit)
                                    setAttachedValue(totalValue)
                                    // trigger re-quote
                                    onRefreshQuotes()
                                } catch (e) {
                                    console.error("Failed to encode and attach message:", e)
                                    toast.showError("Failed to encode actions for permit")
                                } finally {
                                    setIsEncoding(false)
                                }
                            }}
                        >
                            Encode
                        </button>
                    </div>
                )}
                {attachedMessage && dstChainId && (
                    <div className="mt-3 p-3 rounded border border-base-300">
                        <div className="flex items-center justify-between">
                            <div className="text-sm opacity-70">Destination composed call tester</div>
                            <button
                                className={`btn btn-sm ${testingDstCall ? "btn-disabled" : "btn-outline"}`}
                                onClick={async () => {
                                    if (!attachedMessage || !dstChainId) return
                                    try {
                                        setIsEncoding(true)
                                        setTestingDstCall(true)
                                        setTestTxHash(undefined)
                                        if (Number(currentChainId) !== moonbeam.id) {
                                            await switchChainAsync({ chainId: moonbeam.id })
                                        }
                                        const txHash = await sendTestTransaction({
                                            to: CALL_PERMIT_PRECOMPILE as Address,
                                            data: attachedMessage as Hex,
                                            value: (attachedValue ?? 0n) as any,
                                        })
                                        setTestTxHash(txHash as any)
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
