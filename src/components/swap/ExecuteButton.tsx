import { useState, useEffect, useMemo, useCallback } from "react"
import type { Address, Hex } from "viem"
import { zeroAddress } from "viem"
import { useSendTransaction, useWriteContract, usePublicClient, useReadContract } from "wagmi"
import type { GenericTrade } from "@1delta/lib-utils"
import { SupportedChainId } from "@1delta/lib-utils"
import { buildTransactionUrl } from "../../lib/explorer"
import { ERC20_ABI } from "../../lib/abi"
import { encodeFunctionData, parseUnits } from "viem"
import type { DestinationActionConfig } from "../../lib/types/destinationAction"
import { useChainsRegistry } from "../../hooks/useChainsRegistry"
import { usePermitBatch } from "../../hooks/usePermitBatch"
import { useToast } from "../common/ToastHost"

type StepStatus = "idle" | "active" | "done" | "error"

function Step({ label, status }: { label: string; status: StepStatus }) {
    const icon = status === "done" ? "✅" : status === "error" ? "❌" : status === "active" ? "⏳" : "•"
    const cls = status === "error" ? "text-error" : status === "done" ? "text-success" : status === "active" ? "text-warning" : ""
    return (
        <div className={`flex items-center gap-1 ${cls}`}>
            <span>{icon}</span>
            <span className="text-sm">{label}</span>
        </div>
    )
}

async function trackBridgeCompletion(
    trade: GenericTrade,
    srcChainId: string,
    dstChainId: string,
    srcHash: string,
    onDone: (hashes: { src?: string; dst?: string }) => void
) {
    if (!trade.crossChainParams) {
        onDone({ src: srcHash })
        return
    }

    try {
        const { getBridgeStatus } = await import("@1delta/trade-sdk")
        const { Bridge } = await import("@1delta/bridge-configs")

        const bridgeName = Object.values(Bridge).find((b) => b.toString() === trade.aggregator.toString()) || (trade.aggregator as any)

        const maxAttempts = 60
        const delayMs = 5000

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const status = await getBridgeStatus(
                    bridgeName as any,
                    {
                        fromChainId: srcChainId,
                        toChainId: dstChainId,
                        fromHash: srcHash,
                    } as any,
                    trade.crossChainParams
                )

                const statusAny = status as any

                if (status?.toHash) {
                    console.debug("Bridge completed:", { srcHash, dstHash: status.toHash })
                    onDone({ src: srcHash, dst: status.toHash })
                    return
                }

                if (status?.code) {
                    const errorCode = status.code
                    const errorMessage = status?.message || "Bridge transaction failed"
                    console.error("Bridge failed:", errorCode, errorMessage)
                    // Note: We don't show toast here as this is called from trackBridgeCompletion
                    // which runs asynchronously and doesn't have access to toast context
                    onDone({ src: srcHash })
                    return
                }

                if (statusAny?.status === "FAILED" || statusAny?.status === "REVERTED") {
                    const errorCode = statusAny.status
                    const errorMessage = statusAny?.message || statusAny?.error || "Bridge transaction failed"
                    console.error("Bridge failed:", errorCode, errorMessage)
                    // Note: We don't show toast here as this is called from trackBridgeCompletion
                    // which runs asynchronously and doesn't have access to toast context
                    onDone({ src: srcHash })
                    return
                }

                if (statusAny?.status === "COMPLETED" && !status?.toHash) {
                    console.warn("Bridge status shows completed but no destination hash:", status)
                }
            } catch (err) {
                console.debug("Error checking bridge status:", err)
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }

        console.warn("Bridge status check timeout, invalidating source chain balances only")
        onDone({ src: srcHash })
    } catch (err) {
        console.error("Error tracking bridge completion:", err)
        onDone({ src: srcHash })
    }
}

type ExecuteButtonProps = {
    trade: GenericTrade
    srcChainId?: string
    dstChainId?: string
    userAddress?: Address
    srcToken?: Address
    amountWei?: string
    onDone: (hashes: { src?: string; dst?: string }) => void
    chains?: ReturnType<typeof useChainsRegistry>["data"]
    onReset?: () => void
    onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
    onTransactionStart?: () => void
    actions?: Array<{ id: string; config: DestinationActionConfig; selector: Hex; args: any[]; value?: string }>
    permit?: ReturnType<typeof usePermitBatch>
}

export default function ExecuteButton({
    trade,
    srcChainId,
    dstChainId,
    userAddress,
    srcToken,
    amountWei,
    onDone,
    chains,
    onReset,
    onResetStateChange,
    onTransactionStart,
    actions,
    permit,
}: ExecuteButtonProps) {
    const [step, setStep] = useState<"idle" | "approving" | "signing" | "broadcast" | "confirmed" | "error">("idle")
    const [srcHash, setSrcHash] = useState<string | undefined>()
    const [dstHash, setDstHash] = useState<string | undefined>()
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [isBridgeComplete, setIsBridgeComplete] = useState(false)
    const [isBridgeTracking, setIsBridgeTracking] = useState(false)
    const [bridgeTrackingStopped, setBridgeTrackingStopped] = useState(false)
    const { sendTransactionAsync, isPending } = useSendTransaction()
    const { writeContractAsync } = useWriteContract()
    const publicClient = usePublicClient()
    const toast = useToast()

    // Reset error state when trade changes (user selected different quote/aggregator)
    useEffect(() => {
        if (step === "error") {
            setStep("idle")
        }
    }, [trade, step])

    const isBridge = useMemo(() => {
        return Boolean(srcChainId && dstChainId && srcChainId !== dstChainId)
    }, [srcChainId, dstChainId])

    const spender = (trade as any).approvalTarget || (trade as any).target
    const skipApprove = (trade as any).skipApprove || false

    const { data: currentAllowance } = useReadContract({
        address: srcToken && srcToken.toLowerCase() !== zeroAddress.toLowerCase() ? srcToken : undefined,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: userAddress && spender ? [userAddress, spender] : undefined,
        query: {
            enabled: Boolean(srcToken && userAddress && spender && srcToken.toLowerCase() !== zeroAddress.toLowerCase() && !skipApprove),
        },
    })

    const needsApproval = useMemo(() => {
        if (!srcToken || srcToken.toLowerCase() === zeroAddress.toLowerCase() || !spender || skipApprove) {
            return false
        }
        if (!amountWei) return false
        if (currentAllowance === undefined) return true // Still loading, assume approval needed
        const requiredAmount = BigInt(amountWei)
        return currentAllowance < requiredAmount
    }, [srcToken, spender, amountWei, currentAllowance, skipApprove])

    useEffect(() => {
        const showReset = Boolean((isBridgeComplete || (!isBridge && isConfirmed)) && srcHash)
        const resetCallback =
            showReset && onReset
                ? () => {
                      setStep("idle")
                      setSrcHash(undefined)
                      setDstHash(undefined)
                      setIsConfirmed(false)
                      setIsBridgeComplete(false)
                      setIsBridgeTracking(false)
                      setBridgeTrackingStopped(false)
                      setError(undefined)
                      onReset()
                  }
                : undefined
        onResetStateChange?.(showReset, resetCallback)
    }, [isBridgeComplete, isBridge, isConfirmed, srcHash, onReset, onResetStateChange])

    // Extract transaction data from trade
    const getTransactionData = useCallback(async () => {
        if (!trade) return null
        if ("assemble" in trade && typeof (trade as any).assemble === "function") {
            const txData = await (trade as any).assemble()
            if (txData && "EVM" in txData) {
                return (txData as any).EVM
            }
        }
        if ("transaction" in trade && (trade as any).transaction) {
            return (trade as any).transaction
        }
        return null
    }, [trade])

    const execute = useCallback(async () => {
        if (!userAddress || !srcChainId) {
            toast.showError("Missing required parameters")
            return
        }

        // Notify parent that transaction is starting to stop quote refetching
        onTransactionStart?.()

        try {
            let approvalHash: Address | undefined

            if (
                needsApproval &&
                srcToken &&
                amountWei &&
                spender &&
                !(srcChainId === SupportedChainId.MOONBEAM && dstChainId === SupportedChainId.MOONBEAM && actions && actions.length > 0)
            ) {
                setStep("approving")
                approvalHash = await writeContractAsync({
                    address: srcToken,
                    abi: ERC20_ABI as any,
                    functionName: "approve",
                    args: [spender as Address, BigInt(amountWei)],
                })
                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash: approvalHash as any })
                }
            }

            setStep("signing")
            const txData = await getTransactionData()
            if (!txData || !txData.calldata || !txData.to) {
                throw new Error("Failed to get transaction data from trade")
            }

            // Same-chain Moonbeam with actions
            let hash: Address
            if (srcChainId === SupportedChainId.MOONBEAM && dstChainId === SupportedChainId.MOONBEAM && actions && actions.length > 0) {
                if (!permit?.executeSelfTransmit) {
                    setStep("broadcast")
                    hash = await sendTransactionAsync({
                        to: txData.to as Address,
                        data: txData.calldata as Hex,
                        value: txData.value ? BigInt(txData.value.toString()) : BigInt(0),
                    })
                } else {
                    // Build batch calls: optionally approve, then swap, then actions
                    const calls: Array<{ target: Address; value: bigint; callData: Hex; gasLimit: bigint }> = []
                    if (needsApproval && srcToken && amountWei && spender) {
                        const approveCalldata = encodeFunctionData({
                            abi: ERC20_ABI,
                            functionName: "approve",
                            args: [spender as Address, BigInt(amountWei)],
                        })
                        calls.push({
                            target: srcToken,
                            value: 0n,
                            callData: approveCalldata as Hex,
                            gasLimit: BigInt(100000),
                        })
                    }
                    // swap call from aggregator
                    calls.push({
                        target: txData.to as Address,
                        value: txData.value ? BigInt(txData.value.toString()) : 0n,
                        callData: txData.calldata as Hex,
                        gasLimit: BigInt(300000),
                    })
                    // encode user actions
                    try {
                        const { encodeDestinationActions } = await import("../../lib/trade-helpers/destinationActions")
                        const encoded = encodeDestinationActions(
                            actions.map((a) => ({
                                config: a.config,
                                selector: a.selector,
                                args: a.args,
                                value: a.value ? parseUnits(a.value, 18) : 0n,
                            }))
                        )
                        for (const c of encoded) {
                            calls.push({
                                target: c.target,
                                value: c.value ?? 0n,
                                callData: c.calldata as Hex,
                                gasLimit: BigInt(100000),
                            })
                        }
                    } catch (err) {
                        throw new Error("Failed to encode Moonbeam actions")
                    }
                    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30)
                    setStep("broadcast")
                    const { hash: txHash } = await permit.executeSelfTransmit({
                        from: userAddress as Address,
                        calls,
                        deadline,
                    } as any)
                    hash = txHash as Address
                }
            } else {
                setStep("broadcast")
                hash = await sendTransactionAsync({
                    to: txData.to as Address,
                    data: txData.calldata as Hex,
                    value: txData.value ? BigInt(txData.value.toString()) : BigInt(0),
                })
            }
            setSrcHash(hash)
            setStep("confirmed")

            // Wait for confirmation asynchronously
            if (publicClient) {
                publicClient
                    .waitForTransactionReceipt({ hash: hash as any })
                    .then(() => {
                        setIsConfirmed(true)
                        onDone({ src: hash })

                        if (isBridge && trade?.crossChainParams) {
                            setIsBridgeTracking(true)
                            setBridgeTrackingStopped(false)
                            trackBridgeCompletion(trade, srcChainId!, dstChainId!, hash, (hashes) => {
                                setIsBridgeTracking(false)
                                setBridgeTrackingStopped(true)
                                if (hashes.dst) {
                                    setDstHash(hashes.dst)
                                    setIsBridgeComplete(true)
                                }
                                onDone(hashes)
                            })
                        }
                    })
                    .catch((err) => {
                        console.error("Error waiting for transaction receipt:", err)
                    })
            } else {
                onDone({ src: hash })

                if (isBridge && trade?.crossChainParams) {
                    setIsBridgeTracking(true)
                    setBridgeTrackingStopped(false)
                    trackBridgeCompletion(trade, srcChainId!, dstChainId!, hash, (hashes) => {
                        setIsBridgeTracking(false)
                        setBridgeTrackingStopped(true)
                        if (hashes.dst) {
                            setDstHash(hashes.dst)
                            setIsBridgeComplete(true)
                        }
                        onDone(hashes)
                    })
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Transaction failed"
            toast.showError(errorMessage)
            setStep("idle") // Reset to idle so user can retry
            console.error("Execution error:", err)
        }
    }, [
        needsApproval,
        srcToken,
        amountWei,
        spender,
        userAddress,
        srcChainId,
        dstChainId,
        actions,
        permit,
        writeContractAsync,
        getTransactionData,
        sendTransactionAsync,
        publicClient,
        onDone,
        onTransactionStart,
        isBridge,
        trade,
    ])

    const shouldShow = (name: "approving" | "signing" | "broadcast" | "confirmed") => {
        const order = ["approving", "signing", "broadcast", "confirmed"]
        const currentIdx = order.indexOf(step as any)
        const idx = order.indexOf(name)
        if (step === "error") return true
        if (step === "idle") return false
        return idx <= currentIdx
    }

    return (
        <div className="space-y-3">
            {(step === "idle" || step === "error") && (
                <button className="btn btn-primary w-full" onClick={execute} disabled={isPending}>
                    {isBridge ? "Bridge" : "Swap"}
                </button>
            )}
            {step !== "idle" && !srcHash && (
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        {needsApproval && shouldShow("approving") && (
                            <Step label="Approve token" status={step === "approving" ? "active" : step === "error" ? "error" : "done"} />
                        )}
                        {shouldShow("signing") && (
                            <Step
                                label={isBridge ? "Prepare bridge" : "Prepare swap"}
                                status={step === "signing" ? "active" : step === "error" ? "error" : step === "confirmed" ? "done" : "idle"}
                            />
                        )}
                        {shouldShow("broadcast") && (
                            <Step
                                label="Send tx"
                                status={step === "broadcast" ? "active" : step === "error" ? "error" : step === "confirmed" ? "done" : "idle"}
                            />
                        )}
                        {shouldShow("confirmed") && (
                            <Step label="Confirmed" status={step === "confirmed" ? "done" : step === "error" ? "error" : "idle"} />
                        )}
                    </div>
                </div>
            )}
            {srcHash && srcChainId && (
                <div className="space-y-2">
                    <div className="text-sm flex items-center gap-2">
                        <span>Source tx:</span>
                        <a
                            href={buildTransactionUrl(chains || {}, srcChainId, srcHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-primary hover:underline"
                        >
                            {srcHash.slice(0, 4)}...{srcHash.slice(-4)}
                        </a>
                        {isConfirmed ? <span className="text-success">✓</span> : <span className="loading loading-spinner loading-xs"></span>}
                    </div>
                    {isBridge && dstChainId && (
                        <div className="text-sm flex items-center gap-2">
                            <span>Bridge status:</span>
                            {isBridgeComplete && dstHash ? (
                                <>
                                    <span className="text-success">Complete</span>
                                    <a
                                        href={buildTransactionUrl(chains || {}, dstChainId, dstHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-primary hover:underline"
                                    >
                                        Dest: {dstHash.slice(0, 4)}...{dstHash.slice(-4)}
                                    </a>
                                    <span className="text-success">✓</span>
                                </>
                            ) : isBridgeTracking ? (
                                <>
                                    <span className="text-warning">In progress...</span>
                                    <span className="loading loading-spinner loading-xs"></span>
                                </>
                            ) : bridgeTrackingStopped && !isBridgeComplete ? (
                                <>
                                    <span className="text-warning">Status unknown</span>
                                    <span className="text-xs opacity-70">(Check destination chain)</span>
                                </>
                            ) : (
                                <>
                                    <span>Waiting for confirmation...</span>
                                    <span className="loading loading-spinner loading-xs"></span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

