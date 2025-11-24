import { encodeFunctionData, erc20Abi, maxUint256, type Abi, type Address } from "viem"
import { DeltaCallType } from "@1delta/trade-sdk/dist/types"
import type { DestinationCall } from "../../../../lib/types/destinationAction"
import { XCDOT_ADDRESS, STELLA_STDOT_ADDRESS } from "../../../../lib/consts"
import type { DestinationCallBuilder } from "../../shared/types"
import { STELLA_STAKING_ABI } from "./abi"

export type StellaStakingCallBuilderParams = {
  userAddress: Address
}

export const buildCalls: DestinationCallBuilder<StellaStakingCallBuilderParams> = async ({ userAddress }) => {
  const approveCall: DestinationCall = {
    target: XCDOT_ADDRESS,
    calldata: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [STELLA_STDOT_ADDRESS, maxUint256],
    }),
    value: 0n,
    callType: DeltaCallType.DEFAULT,
  }

  const depositCall: DestinationCall = {
    target: STELLA_STDOT_ADDRESS,
    calldata: encodeFunctionData({
      abi: STELLA_STAKING_ABI,
      functionName: "deposit",
      args: [0n],
    }),
    value: 0n,
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    tokenAddress: XCDOT_ADDRESS,
    balanceOfInjectIndex: 0,
    gasLimit: 600000n,
  }

  const sweepCall: DestinationCall = {
    target: STELLA_STDOT_ADDRESS,
    calldata: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [userAddress, 0n],
    }),
    value: 0n,
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    tokenAddress: STELLA_STDOT_ADDRESS,
    balanceOfInjectIndex: 1,
    gasLimit: 600000n,
  }

  return [approveCall, depositCall, sweepCall]
}
