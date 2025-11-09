import { Address, Hex, Abi } from "viem"

/**
 * Destination action type enum
 */
export type DestinationActionType = "game_token" | "buy_ticket" | "custom"

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

