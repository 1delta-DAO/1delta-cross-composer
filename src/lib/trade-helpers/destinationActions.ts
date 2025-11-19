import { encodeFunctionData, decodeFunctionData, toFunctionSelector, type Abi, type Address, type Hex } from "viem"
import { SimpleSquidCallType } from "@1delta/trade-sdk/dist/composedTrades/axelar/squid/types"
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
    throw new Error(`Composer-based actions must be encoded in ActionsPanel where signing is available. Action: ${config?.name || ""}`)
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

function toSimpleSquidCalls(calls: EncodedDestinationAction[]): Array<{
  callType: SimpleSquidCallType
  target: string
  value?: bigint
  callData: Hex
  balanceOfInjectIndex?: number
}> {
  return calls.map((c) => {
    const callType = (c.callType as SimpleSquidCallType | undefined) ?? SimpleSquidCallType.DEFAULT
    const base = {
      callType,
      target: c.target,
      value: c.value && c.value > 0n ? c.value : undefined,
      callData: c.calldata,
    }
    if (callType === SimpleSquidCallType.FULL_TOKEN_BALANCE) {
      const balanceOfInjectIndex = typeof c.balanceOfInjectIndex === "number" ? c.balanceOfInjectIndex : 0
      return {
        ...base,
        balanceOfInjectIndex,
      }
    }
    return base
  })
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
  callType: SimpleSquidCallType
  target: string
  value?: bigint
  callData: Hex
  balanceOfInjectIndex?: number
}> {
  const calls = decodeEncodedActionsMessage(message)
  return toSimpleSquidCalls(calls)
}
