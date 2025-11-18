import { type Hex, type Address, type Abi } from "viem"
import type { DestinationActionConfig } from "../../../types/destinationAction"
import { SupportedChainId, getDeltaComposerAddress } from "@1delta/lib-utils"
import { XCDOT_ADDRESS, STELLA_STDOT_ADDRESS, CALL_PERMIT_PRECOMPILE, CALL_FORWARDER_ADDRESS } from "../../../consts"

const PERMIT_DISPATCH_SELECTOR: Hex = "0xb5ea0966"

const STAKING_ABI: Abi = [
    {
        type: "function",
        name: "deposit",
        inputs: [
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
] as Abi

const base: Omit<DestinationActionConfig, "functionSelectors" | "name" | "description" | "defaultFunctionSelector" | "address"> = {
    abi: STAKING_ABI,
    actionType: "staking",
    group: "staking",
}

export function getActions(opts?: { dstToken?: string; dstChainId?: string }): DestinationActionConfig[] {
    if (opts?.dstChainId && opts.dstChainId !== SupportedChainId.MOONBEAM) {
        return []
    }

    const chainId = opts?.dstChainId || SupportedChainId.MOONBEAM
    const composerAddress = getDeltaComposerAddress(chainId)

    if (!composerAddress) {
        return []
    }

    const items: DestinationActionConfig[] = []

    const action: DestinationActionConfig = {
        ...base,
        address: CALL_PERMIT_PRECOMPILE,
        name: "Stake DOT",
        description: "Stake DOT to StellaSwap using 1delta composer",
        functionSelectors: [PERMIT_DISPATCH_SELECTOR],
        defaultFunctionSelector: PERMIT_DISPATCH_SELECTOR,
        meta: {
            useComposer: true,
            underlying: XCDOT_ADDRESS,
            stakedToken: STELLA_STDOT_ADDRESS,
            composerAddress: composerAddress as Address,
            callForwarderAddress: CALL_FORWARDER_ADDRESS,
            symbol: "DOT",
            decimals: 10,
        },
    }

    if (!opts?.dstToken || opts.dstToken.toLowerCase() === XCDOT_ADDRESS.toLowerCase()) {
        items.push(action)
    }

    return items
}
