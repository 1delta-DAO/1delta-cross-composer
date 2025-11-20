import { encodeFunctionData, toFunctionSelector, type Abi, type Address, type Hex } from "viem"
import type { DestinationActionConfig } from "../../../types/destinationAction"
import { MTOKEN_ABI } from "./mTokenAbi"
import type { MoonwellMarket } from "../../../../hooks/useMoonwellMarkets"
import { getCachedMarkets, isMarketsReady } from "../../../moonwell/marketCache"
import { SupportedChainId } from "@1delta/lib-utils"
import { ERC20_ABI } from "../../../abi"
import { MOONWELL_COMPTROLLER } from "../../../moonwell/consts"
import { DeltaCallType } from "@1delta/trade-sdk/dist/types"
import type { RawCurrency } from "../../../../types/currency"

const base: Omit<DestinationActionConfig, "functionSelectors" | "name" | "description" | "defaultFunctionSelector" | "address"> = {
  abi: MTOKEN_ABI,
  actionType: "lending",
  group: "lending",
}

const actionTemplates: Omit<DestinationActionConfig, "address">[] = [
  {
    ...base,
    name: "Mint",
    description: "Deposit asset to Moonwell",
    functionSelectors: ["0xa0712d68" as Hex],
    defaultFunctionSelector: "0xa0712d68" as Hex,
    meta: { usePermitPrecompile: true, preApproveFromUnderlying: true, preApproveAmountArgIndex: 0, enterMarketBefore: true },
  },
  {
    ...base,
    name: "Borrow",
    description: "Borrow asset from Moonwell",
    functionSelectors: ["0xc5ebeaec" as Hex],
    defaultFunctionSelector: "0xc5ebeaec" as Hex,
    meta: { usePermitPrecompile: true, enterMarketBefore: true },
  },
  {
    ...base,
    name: "Withdraw",
    description: "Withdraw asset from Moonwell",
    functionSelectors: ["0xdb006a75" as Hex],
    defaultFunctionSelector: "0xdb006a75" as Hex,
    meta: { usePermitPrecompile: true },
  },
  {
    ...base,
    name: "Repay",
    description: "Repay borrowed asset on Moonwell",
    functionSelectors: ["0x0e752702" as Hex],
    defaultFunctionSelector: "0x0e752702" as Hex,
    meta: { usePermitPrecompile: true, preApproveFromUnderlying: true, preApproveAmountArgIndex: 0 },
  },
]

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

export function getActionsForMarket(market: MoonwellMarket, dstToken?: string): DestinationActionConfig[] {
  const symbol = market.symbol || ""
  const underlyingLower = (market.underlyingCurrency?.address || "").toLowerCase()
  const dstLower = (dstToken || "").toLowerCase()

  const items: DestinationActionConfig[] = []

  for (const template of actionTemplates) {
    if (template.name === "Mint" && dstToken && dstLower && underlyingLower && dstLower !== underlyingLower) {
      continue
    }

    if (template.name === "Borrow" && market.borrowPaused) {
      continue
    }

    const actionName = template.name === "Mint" ? `Deposit ${symbol}`.trim() : `${template.name} ${symbol}`.trim()

    const actionDescription =
      template.name === "Mint"
        ? `Deposit ${symbol} to Moonwell`
        : template.name === "Borrow"
          ? `Borrow ${symbol} from Moonwell`
          : template.name === "Withdraw"
            ? `Withdraw ${symbol} from Moonwell`
            : `Repay borrowed ${symbol} on Moonwell`

    const underlyingCurrency: RawCurrency | undefined = market.underlyingCurrency || undefined

    const finalMeta = {
      ...template.meta,
      underlying: underlyingCurrency,
      supportedChainIds: [SupportedChainId.MOONBEAM, SupportedChainId.BASE, SupportedChainId.OPBNB_MAINNET, SupportedChainId.MOONRIVER],
    }

    items.push({
      ...template,
      address: market.mTokenCurrency.address as Address,
      name: actionName,
      description: actionDescription,
      meta: {
        ...finalMeta,
      },
      buildCalls: async (ctx) => {
        const calls: { target: Address; calldata: Hex; value?: bigint; callType?: number; tokenAddress?: Address; balanceOfInjectIndex?: number }[] =
          []
        const meta = finalMeta as any
        const underlying = meta.underlying as RawCurrency | undefined
        const selector = ctx.selector
        const args = ctx.args || []
        const value = ctx.value ?? 0n

        if (meta.preApproveFromUnderlying && underlying) {
          const underlyingAddr = underlying.address as Address
          const idx = typeof meta.preApproveAmountArgIndex === "number" ? meta.preApproveAmountArgIndex : 0
          const amountArg = args[idx]
          if (underlyingAddr && amountArg !== undefined) {
            const approveCalldata = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [market.mTokenCurrency.address as Address, BigInt(String(amountArg))],
            })
            calls.push({
              target: underlyingAddr,
              calldata: approveCalldata as Hex,
              value: 0n,
              callType: DeltaCallType.FULL_TOKEN_BALANCE,
              tokenAddress: underlyingAddr,
              balanceOfInjectIndex: idx,
            })
          }
        }

        if (meta.enterMarketBefore) {
          const enterData = encodeFunctionData({
            abi: [
              {
                inputs: [{ internalType: "address[]", name: "cTokens", type: "address[]" }],
                name: "enterMarkets",
                outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
                stateMutability: "nonpayable",
                type: "function",
              },
            ] as Abi,
            functionName: "enterMarkets",
            args: [[market.mTokenCurrency.address as Address]],
          })
          calls.push({
            target: MOONWELL_COMPTROLLER as Address,
            calldata: enterData as Hex,
            value: 0n,
            callType: DeltaCallType.DEFAULT,
          })
        }

        const functionName = getFunctionNameFromSelector(MTOKEN_ABI as Abi, selector) || MTOKEN_ABI.find((x: any) => x?.type === "function")?.name

        if (!functionName) {
          throw new Error(`Could not determine function name for Moonwell action ${actionName}`)
        }

        const mainCalldata = encodeFunctionData({
          abi: MTOKEN_ABI as Abi,
          functionName,
          args: args as any[],
        })

        calls.push({
          target: market.mTokenCurrency.address as Address,
          calldata: mainCalldata as Hex,
          value,
          callType: DeltaCallType.FULL_TOKEN_BALANCE,
          tokenAddress: (underlying?.address || market.underlyingCurrency.address) as Address,
          balanceOfInjectIndex: 0,
        })

        return calls
      },
    } as DestinationActionConfig)
  }

  // sort: Deposit, Borrow, Withdraw, Repay
  const priority = (n: string) =>
    n.startsWith("Deposit") ? 0 : n.startsWith("Borrow") ? 1 : n.startsWith("Withdraw") ? 2 : n.startsWith("Repay") ? 3 : 9
  return items.sort((a, b) => priority(a.name) - priority(b.name) || a.name.localeCompare(b.name))
}

export function getActions(opts?: { dstToken?: string; dstChainId?: string }): DestinationActionConfig[] {
  // Only return actions for Moonbeam (chainId 1284)
  if (opts?.dstChainId && opts.dstChainId !== SupportedChainId.MOONBEAM) {
    return []
  }

  // Check if markets are ready
  if (!isMarketsReady()) {
    return []
  }

  const markets = getCachedMarkets()
  if (!markets || markets.length === 0) {
    return []
  }

  const items: DestinationActionConfig[] = []
  for (const market of markets) {
    const actions = getActionsForMarket(market, opts?.dstToken)
    items.push(...actions)
  }

  return items
}
