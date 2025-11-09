import { Address, Hex } from "viem"
import { DestinationActionConfig } from "../types/destinationAction"

/**
 * Destination actions configuration
 * This can be extended via config files without code changes
 */
export const DESTINATION_ACTIONS: DestinationActionConfig[] = [
    // Example demo action so the UI works
    {
        address: "0x0000000000000000000000000000000000000001" as Address,
        functionSelectors: ["0x40c10f19" as Hex], // mint(address,uint256)
        abi: [
            {
                type: "function",
                name: "mint",
                stateMutability: "nonpayable",
                inputs: [
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                ],
                outputs: [],
            },
        ] as any,
        actionType: "game_token",
        name: "Demo Mint",
        description: "Mint demo token on Moonbeam",
        defaultFunctionSelector: "0x40c10f19" as Hex,
    },
]

/**
 * Get destination actions by type
 */
export function getDestinationActionsByType(type: DestinationActionConfig["actionType"]): DestinationActionConfig[] {
    return DESTINATION_ACTIONS.filter((action) => action.actionType === type)
}

/**
 * Get destination action by address
 */
export function getDestinationActionByAddress(address: string): DestinationActionConfig | undefined {
    return DESTINATION_ACTIONS.find((action) => action.address.toLowerCase() === address.toLowerCase())
}

