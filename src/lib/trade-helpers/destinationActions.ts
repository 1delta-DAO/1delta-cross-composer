import { encodeFunctionData, decodeFunctionData, toFunctionSelector, type Abi, type Address, type Hex } from "viem"
import type { DestinationActionConfig, EncodedDestinationAction } from "../../lib/types/destinationAction"

export type PendingActionInput = {
    config: DestinationActionConfig
    selector: Hex
    args: unknown[]
    value?: bigint
    functionName?: string
}

export type EncodedActionsBundle = {
    message: Hex
    totalValue: bigint
    estimatedDestinationGasLimit?: bigint
    calls: EncodedDestinationAction[]
}

function getFunctionNameFromSelector(abi: Abi, selector: Hex): string | undefined {
    const functions = (abi as any[]).filter((x: any) => x?.type === "function")
    for (const fn of functions) {
        try {
            const fnSelector = toFunctionSelector(fn)
            if (fnSelector.toLowerCase() === selector.toLowerCase()) {
                return fn.name
            }
        } catch {}
    }
    return undefined
}

function encodeDestinationAction(input: PendingActionInput): EncodedDestinationAction {
    const { config, selector, args, value, functionName } = input
    
    const meta = config?.meta || {}
    if (meta.useComposer) {
        throw new Error(
            `Composer-based actions must be encoded in MoonbeamActionsPanel where signing is available. Action: ${config?.name || ""}`
        )
    }
    
    if (!config?.abi || !Array.isArray(config.abi)) {
        throw new Error(`Invalid ABI for action ${config?.name || ""}`)
    }
    if (!config?.address) {
        throw new Error(`Missing target address for action ${config?.name || ""}`)
    }

    const resolvedFunctionName =
        functionName || getFunctionNameFromSelector(config.abi, selector) || (config.abi as any[]).find((x: any) => x?.type === "function")?.name

    if (!resolvedFunctionName) {
        throw new Error(`Could not determine function name for action ${config?.name || ""} with selector ${selector}`)
    }

    const calldata = encodeFunctionData({
        abi: config.abi as Abi,
        functionName: resolvedFunctionName,
        args: args as any[],
    })

    return {
        target: config.address as Address,
        calldata,
        value: value ?? 0n,
    }
}

export function encodeDestinationActions(actions: PendingActionInput[]): EncodedDestinationAction[] {
    return actions.map((a) => encodeDestinationAction(a))
}

function combineEncodedActions(calls: EncodedDestinationAction[], opts?: { gasPerAction?: bigint }): EncodedActionsBundle {
    const to: Address[] = calls.map((c) => c.target)
    const value: bigint[] = calls.map((c) => c.value ?? 0n)
    const data: Hex[] = calls.map((c) => c.calldata)
    const tupleAbi: Abi = [
        {
            type: "function",
            name: "batch",
            stateMutability: "payable",
            inputs: [
                { name: "to", type: "address[]" },
                { name: "value", type: "uint256[]" },
                { name: "data", type: "bytes[]" },
            ],
            outputs: [],
        },
    ] as any

    const message = encodeFunctionData({
        abi: tupleAbi,
        functionName: "batch",
        args: [to, value, data],
    })

    const totalValue = value.reduce((acc, v) => acc + (v ?? 0n), 0n)
    const estimatedDestinationGasLimit = opts?.gasPerAction && opts.gasPerAction > 0n ? opts.gasPerAction * BigInt(calls.length) : undefined

    return {
        message,
        totalValue,
        estimatedDestinationGasLimit,
        calls,
    }
}

function toSimpleSquidCalls(calls: EncodedDestinationAction[]): Array<{
    callType: 0
    target: string
    value?: bigint
    callData: Hex
}> {
    return calls.map((c) => ({
        callType: 0, // SimpleSquidCallType.DEFAULT
        target: c.target,
        value: c.value && c.value > 0n ? c.value : undefined,
        callData: c.calldata,
    }))
}

function decodeEncodedActionsMessage(message: Hex): EncodedDestinationAction[] {
    const tupleAbi: Abi = [
        {
            type: "function",
            name: "batch",
            stateMutability: "payable",
            inputs: [
                { name: "to", type: "address[]" },
                { name: "value", type: "uint256[]" },
                { name: "data", type: "bytes[]" },
            ],
            outputs: [],
        },
    ] as any

    const decoded = decodeFunctionData({
        abi: tupleAbi,
        data: message,
    }) as unknown as { functionName: string; args: [Address[], bigint[], Hex[]] }

    const [to, value, data] = decoded.args
    const calls: EncodedDestinationAction[] = []
    for (let i = 0; i < to.length; i++) {
        calls.push({
            target: to[i],
            value: value[i] ?? 0n,
            calldata: data[i],
        })
    }
    return calls
}

export function simpleSquidCallsFromMessage(message: Hex): Array<{
    callType: 0
    target: string
    value?: bigint
    callData: Hex
}> {
    const calls = decodeEncodedActionsMessage(message)
    return toSimpleSquidCalls(calls)
}
