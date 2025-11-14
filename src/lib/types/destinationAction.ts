import { Address, Hex, Abi } from "viem"

/**
 * Destination action type enum
 */
export type DestinationActionType = "game_token" | "buy_ticket" | "lending" | "staking"

/**
 * Structured interface for destination actions (game-related actions on Moonbeam)
 */
export interface DestinationAction {
    /** EVM address of the contract */
    address: Address
    /** Array of function selectors (4-byte hex) that are available for this action */
    functionSelectors: Hex[]
    /** Contract ABI for encoding calldata */
    abi: Abi
    /** Type of action */
    actionType: DestinationActionType
    /** Optional grouping/category (e.g.) */
    group?: string
    /** Optional metadata used by UI */
    meta?: {
        underlying?: Address
        symbol?: string
        decimals?: number
        /** If true, UI/app should use permit precompile flow for composed destination actions */
        usePermitPrecompile?: boolean
        /** Insert ERC20 approve( spender=config.address, amount=args[preApproveAmountArgIndex] ) for 'underlying' before the main call */
        preApproveFromUnderlying?: boolean
        /** Index of the uint256 amount argument to reuse for approve amount (default: 0) */
        preApproveAmountArgIndex?: number
        /** If true, insert Comptroller enterMarkets before main (for lending) */
        enterMarketBefore?: boolean
        /** If true, action uses 1delta composer wrapped in permit precompile call */
        useComposer?: boolean
        /** Output token address (e.g., staked token) */
        stakedToken?: Address
        /** Composer contract address */
        composerAddress?: Address
        /** Call forwarder contract address */
        callForwarderAddress?: Address
    }
    /** Display name */
    name: string
    /** Description */
    description: string
    /** Optional icon URL */
    icon?: string
    /** Default function selector to use if not specified */
    defaultFunctionSelector?: Hex
}

/**
 * Configuration for a destination action with parameters
 */
export interface DestinationActionConfig extends DestinationAction {
    /** Optional default parameters */
    defaultParams?: Record<string, unknown>
}

/**
 * Encoded destination action ready to be added to batch
 */
export interface EncodedDestinationAction {
    target: Address
    calldata: Hex
    value?: bigint
}
