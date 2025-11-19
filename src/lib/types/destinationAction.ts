import { Address, Hex, Abi } from "viem"

export type DestinationActionType = "game_token" | "buy_ticket" | "lending" | "staking"

export interface DestinationActionMeta {
  underlying?: Address
  symbol?: string
  decimals?: number
  usePermitPrecompile?: boolean
  preApproveFromUnderlying?: boolean
  preApproveAmountArgIndex?: number
  enterMarketBefore?: boolean
  useComposer?: boolean
  stakedToken?: Address
  composerAddress?: Address
  callForwarderAddress?: Address
  supportedChainIds?: string[]
  [key: string]: unknown
}

export interface DestinationAction {
  address: Address
  functionSelectors: Hex[]
  abi: Abi
  actionType: DestinationActionType
  group?: string
  meta?: DestinationActionMeta
  name: string
  description: string
  icon?: string
  defaultFunctionSelector?: Hex
}

export interface EncodedDestinationAction {
  target: Address
  calldata: Hex
  value?: bigint
  callType?: number
  balanceOfInjectIndex?: number
}

export interface DestinationActionBuildContext {
  userAddress: Address
  dstChainId?: string
  selector: Hex
  args: unknown[]
  value?: bigint
}

export interface DestinationActionConfig extends DestinationAction {
  defaultParams?: Record<string, unknown>
  buildCalls?: (ctx: DestinationActionBuildContext) => Promise<EncodedDestinationAction[]>
}

export interface DestinationCall extends EncodedDestinationAction {
  gasLimit?: bigint
}
