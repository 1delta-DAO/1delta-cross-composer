import { useState, useMemo } from "react"
import type { Address, Hex } from "viem"
import { encodeFunctionData, parseUnits, maxUint256 } from "viem"
import { useSendTransaction, useSignTypedData, useSwitchChain, useReadContract, useWriteContract, usePublicClient } from "wagmi"
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
    const [enablePermitBatch, setEnablePermitBatch] = useState<boolean>(true)
    const [approvingComposer, setApprovingComposer] = useState<string | null>(null)
    const permitBatch = usePermitBatch()
    const { fetchNonce } = permitBatch
    const { signTypedDataAsync } = useSignTypedData()
    const { switchChainAsync } = useSwitchChain()
    const { writeContractAsync } = useWriteContract()
    const publicClient = usePublicClient()
    const toast = useToast()

    const composerApprovals = useMemo(() => {
        const approvals: Array<{ token: Address; composer: Address; actionId: string }> = []
        for (const action of actions) {
            const meta = (action.config as any)?.meta || {}
            if (meta.useComposer && meta.underlying && meta.composerAddress) {
                approvals.push({
                    token: meta.underlying as Address,
                    composer: meta.composerAddress as Address,
                    actionId: action.id,
                })
            }
        }
        return approvals
    }, [actions])

    const firstComposerApproval = composerApprovals[0]
    const { data: composerAllowance } = useReadContract({
        address: firstComposerApproval?.token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: userAddress && firstComposerApproval?.composer ? [userAddress, firstComposerApproval.composer] : undefined,
        query: {
            enabled: Boolean(firstComposerApproval && userAddress && Number(currentChainId) === moonbeam.id),
        },
    })

    const needsComposerApproval = useMemo(() => {
        if (!firstComposerApproval || !userAddress) return false
        if (Number(currentChainId) !== moonbeam.id) return true
        if (composerAllowance === undefined) return true
        return composerAllowance === 0n
    }, [firstComposerApproval, userAddress, composerAllowance, currentChainId])

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
                {composerApprovals.length > 0 && firstComposerApproval && (
                    <div className="mt-4 p-3 rounded border border-warning/30 bg-warning/5">
                        <div className="text-sm font-medium mb-2">Composer Approval Required</div>
                        <div className="text-xs opacity-70 mb-2">
                            Approve composer to pull tokens for staking. This must be done on Moonbeam before encoding actions.
                        </div>
                        {!needsComposerApproval ? (
                            <div className="text-xs text-success">✓ Composer already approved</div>
                        ) : (
                            <button
                                className="btn btn-sm btn-warning"
                                disabled={approvingComposer !== null}
                                onClick={async () => {
                                    if (!userAddress || !firstComposerApproval || !publicClient) return
                                    const sourceChainId = currentChainId
                                    try {
                                        setApprovingComposer(firstComposerApproval.actionId)
                                        setIsEncoding(true)

                                        let actualChainId = await publicClient.getChainId()

                                        if (actualChainId !== moonbeam.id) {
                                            try {
                                                await switchChainAsync({ chainId: moonbeam.id })
                                                let attempts = 0
                                                while (attempts < 20) {
                                                    actualChainId = await publicClient.getChainId()
                                                    if (actualChainId === moonbeam.id) break
                                                    await new Promise((resolve) => setTimeout(resolve, 500))
                                                    attempts++
                                                }
                                                if (actualChainId !== moonbeam.id) {
                                                    toast.showError("Failed to switch to Moonbeam. Please switch manually.")
                                                    return
                                                }
                                                await new Promise((resolve) => setTimeout(resolve, 1000))
                                            } catch (e) {
                                                toast.showError("Failed to switch to Moonbeam. Please switch manually.")
                                                return
                                            }
                                        }

                                        actualChainId = await publicClient.getChainId()
                                        if (actualChainId !== moonbeam.id) {
                                            toast.showError("Not on Moonbeam chain. Please switch manually.")
                                            return
                                        }

                                        const hash = await writeContractAsync({
                                            address: firstComposerApproval.token,
                                            abi: ERC20_ABI as any,
                                            functionName: "approve",
                                            args: [firstComposerApproval.composer, maxUint256],
                                        })

                                        actualChainId = await publicClient.getChainId()
                                        if (actualChainId !== moonbeam.id) {
                                            toast.showError("Chain switched during transaction. Please try again.")
                                            return
                                        }

                                        await publicClient.waitForTransactionReceipt({ hash: hash as any })

                                        actualChainId = await publicClient.getChainId()
                                        if (actualChainId === moonbeam.id && actualChainId !== sourceChainId) {
                                            try {
                                                await switchChainAsync({ chainId: sourceChainId })
                                                let attempts = 0
                                                while (attempts < 20) {
                                                    actualChainId = await publicClient.getChainId()
                                                    if (actualChainId === sourceChainId) break
                                                    await new Promise((resolve) => setTimeout(resolve, 500))
                                                    attempts++
                                                }
                                            } catch (e) {
                                                console.warn("Failed to switch back to source chain:", e)
                                            }
                                        }

                                        toast.showSuccess(`Composer approved successfully`)
                                    } catch (e: any) {
                                        if (publicClient) {
                                            try {
                                                const actualChainId = await publicClient.getChainId()
                                                if (actualChainId !== sourceChainId) {
                                                    await switchChainAsync({ chainId: sourceChainId })
                                                    let attempts = 0
                                                    while (attempts < 20) {
                                                        const chainId = await publicClient.getChainId()
                                                        if (chainId === sourceChainId) break
                                                        await new Promise((resolve) => setTimeout(resolve, 500))
                                                        attempts++
                                                    }
                                                }
                                            } catch (switchError) {
                                                console.warn("Failed to switch back to source chain after error:", switchError)
                                            }
                                        }
                                        toast.showError(e?.message || "Failed to approve composer")
                                    } finally {
                                        setApprovingComposer(null)
                                        setIsEncoding(false)
                                    }
                                }}
                            >
                                {approvingComposer ? "Approving..." : "Approve Composer"}
                            </button>
                        )}
                    </div>
                )}
                {actions.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <div className="form-control">
                            <label className="label cursor-pointer justify-start gap-2">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={enablePermitBatch}
                                    onChange={(e) => setEnablePermitBatch(e.target.checked)}
                                />
                                <span className="label-text text-sm">Use Permit/Batch (wrap calls in permit precompile)</span>
                            </label>
                        </div>
                        <div className="flex justify-center">
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
                                        const { encodeStellaDotStakingComposerCalldata } = await import("../../lib/trade-helpers/composerEncoding")
                                        const preCalls: Array<{ target: Address; value: bigint; callData: Hex; gasLimit: bigint }> = []
                                        const actionCalls: Array<{ target: Address; value: bigint; callData: Hex; gasLimit: bigint }> = []
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
                                            const regularActionCalls = encoded.map((c) => ({
                                                target: c.target,
                                                value: c.value ?? 0n,
                                                callData: c.calldata as Hex,
                                                gasLimit: BigInt(250000),
                                            }))
                                            actionCalls.push(...regularActionCalls)
                                        }

                                        // Add composer actions to actionCalls (as raw composer calldata, not permit-wrapped)
                                        for (const composerAction of composerActions) {
                                            actionCalls.push({
                                                target: composerAction.composerAddress,
                                                value: 0n,
                                                callData: composerAction.composerCalldata,
                                                gasLimit: composerAction.gasLimit,
                                            })
                                        }

                                        const allCalls = [...preCalls, ...actionCalls]
                                        const totalActions = composerActions.length + regularActions.length
                                        const needsBatching = totalActions > 1

                                        let message: Hex
                                        let gasLimit: bigint
                                        let totalValue: bigint

                                        if (!enablePermitBatch) {
                                            // Send calldata as-is (for additional calls, will likely fail but gives flexibility)
                                            if (totalActions === 1 && composerActions.length === 1) {
                                                // Single composer action - send composer calldata directly
                                                message = composerActions[0].composerCalldata
                                                gasLimit = composerActions[0].gasLimit
                                                totalValue = 0n
                                            } else if (totalActions === 1 && regularActions.length === 1 && preCalls.length === 0) {
                                                // Single regular action - send calldata directly
                                                message = actionCalls[0].callData
                                                gasLimit = actionCalls[0].gasLimit
                                                totalValue = actionCalls[0].value ?? 0n
                                            } else {
                                                // Multiple actions - batch them
                                                const batchData = permitBatch.createBatchData(allCalls as any)
                                                message = batchData
                                                gasLimit = allCalls.reduce((acc, c) => acc + c.gasLimit, 0n)
                                                totalValue = allCalls.reduce((acc, c) => acc + (c.value ?? 0n), 0n)
                                            }
                                        } else if (!needsBatching && totalActions === 1 && composerActions.length === 1) {
                                            // Single composer action with permit/batch enabled - wrap in permit call
                                            const composerAction = composerActions[0]
                                            const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30)
                                            const currentNonce = await fetchNonce(userAddress, moonbeam.id)
                                            if (currentNonce === null) {
                                                throw new Error("Failed to fetch nonce for permit")
                                            }
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
                                                    to: composerAction.composerAddress,
                                                    value: 0n,
                                                    data: composerAction.composerCalldata,
                                                    gaslimit: composerAction.gasLimit,
                                                    nonce: currentNonce,
                                                    deadline,
                                                },
                                            }
                                            const signature = await signTypedDataAsync(typedData as any)
                                            const sig = signature.slice(2)
                                            const r = `0x${sig.slice(0, 64)}` as Hex
                                            const s = `0x${sig.slice(64, 128)}` as Hex
                                            const v = parseInt(sig.slice(128, 130), 16)
                                            message = encodeFunctionData({
                                                abi: CALL_PERMIT_ABI as any,
                                                functionName: "dispatch",
                                                args: [
                                                    userAddress,
                                                    composerAction.composerAddress,
                                                    0n,
                                                    composerAction.composerCalldata,
                                                    composerAction.gasLimit,
                                                    deadline,
                                                    v,
                                                    r,
                                                    s,
                                                ],
                                            }) as Hex
                                            gasLimit = composerAction.gasLimit
                                            totalValue = 0n
                                        } else if (!needsBatching && totalActions === 1 && regularActions.length === 1 && preCalls.length === 0) {
                                            // Single regular action with no preCalls - wrap in permit call
                                            const singleCall = actionCalls[0]
                                            const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30)
                                            const currentNonce = await fetchNonce(userAddress, moonbeam.id)
                                            if (currentNonce === null) {
                                                throw new Error("Failed to fetch nonce for permit")
                                            }
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
                                                    to: singleCall.target,
                                                    value: singleCall.value ?? 0n,
                                                    data: singleCall.callData,
                                                    gaslimit: singleCall.gasLimit,
                                                    nonce: currentNonce,
                                                    deadline,
                                                },
                                            }
                                            const signature = await signTypedDataAsync(typedData as any)
                                            const sig = signature.slice(2)
                                            const r = `0x${sig.slice(0, 64)}` as Hex
                                            const s = `0x${sig.slice(64, 128)}` as Hex
                                            const v = parseInt(sig.slice(128, 130), 16)
                                            message = encodeFunctionData({
                                                abi: CALL_PERMIT_ABI as any,
                                                functionName: "dispatch",
                                                args: [
                                                    userAddress,
                                                    singleCall.target,
                                                    singleCall.value ?? 0n,
                                                    singleCall.callData,
                                                    singleCall.gasLimit,
                                                    deadline,
                                                    v,
                                                    r,
                                                    s,
                                                ],
                                            }) as Hex
                                            gasLimit = singleCall.gasLimit
                                            totalValue = singleCall.value ?? 0n
                                        } else {
                                            // Multiple actions - batch them and wrap in permit call
                                            const batchData = permitBatch.createBatchData(allCalls as any)
                                            gasLimit = BigInt(800000)
                                            totalValue = allCalls.reduce((acc, c) => acc + (c.value ?? 0n), 0n)
                                            const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30)
                                            const currentNonce = await fetchNonce(userAddress, moonbeam.id)
                                            if (currentNonce === null) {
                                                throw new Error("Failed to fetch nonce for permit")
                                            }
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
                                            message = encodeFunctionData({
                                                abi: CALL_PERMIT_ABI as any,
                                                functionName: "dispatch",
                                                args: [userAddress, BATCH_PRECOMPILE, totalValue, batchData, gasLimit, deadline, v, r, s],
                                            }) as Hex
                                        }

                                        try {
                                            console.log("Signed destination actions (Moonbeam)", {
                                                totalActions,
                                                composerActions: composerActions.length,
                                                regularActions: regularActions.length,
                                                enablePermitBatch,
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

                                        let destinationAddress: Address

                                        if (enablePermitBatch) {
                                            destinationAddress = CALL_PERMIT_PRECOMPILE
                                        } else {
                                            const composerActions = actions.filter((a) => (a.config as any)?.meta?.useComposer)
                                            const regularActions = actions.filter((a) => !(a.config as any)?.meta?.useComposer)
                                            const totalActions = composerActions.length + regularActions.length

                                            if (totalActions === 1 && composerActions.length === 1) {
                                                destinationAddress = (composerActions[0].config as any)?.meta?.composerAddress as Address
                                            } else if (totalActions > 1) {
                                                destinationAddress = BATCH_PRECOMPILE
                                            } else if (regularActions.length === 1) {
                                                destinationAddress = regularActions[0].config.address as Address
                                            } else {
                                                destinationAddress = CALL_PERMIT_PRECOMPILE
                                            }
                                        }

                                        const txHash = await sendTestTransaction({
                                            to: destinationAddress,
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
