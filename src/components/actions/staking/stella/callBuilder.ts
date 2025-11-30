import { encodeFunctionData, erc20Abi, maxUint256, type Abi, type Address } from 'viem'
import { DeltaCallType } from '@1delta/lib-utils'
import type { ActionCall } from '../../shared/types'
import { XCDOT_ADDRESS, STELLA_STDOT_ADDRESS } from '../../../../lib/consts'
import type { ActionCallBuilder } from '../../shared/types'
import { STELLA_STAKING_ABI } from './abi'

export type StellaStakingCallBuilderParams = {
  userAddress: Address
}

export const buildCalls: ActionCallBuilder<StellaStakingCallBuilderParams> = async ({
  userAddress,
}) => {
  const approveCall: ActionCall = {
    callType: DeltaCallType.DEFAULT,
    target: XCDOT_ADDRESS,
    callData: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [STELLA_STDOT_ADDRESS, maxUint256],
    }),
    value: 0n,
  }

  const depositCall: ActionCall = {
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    target: STELLA_STDOT_ADDRESS,
    callData: encodeFunctionData({
      abi: STELLA_STAKING_ABI,
      functionName: 'deposit',
      args: [0n],
    }),
    value: 0n,
    tokenAddress: XCDOT_ADDRESS,
    balanceOfInjectIndex: 0,
    gasLimit: 600000n,
  }

  const sweepCall: ActionCall = {
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    target: STELLA_STDOT_ADDRESS,
    callData: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [userAddress, 0n],
    }),
    value: 0n,
    tokenAddress: STELLA_STDOT_ADDRESS,
    balanceOfInjectIndex: 1,
    gasLimit: 600000n,
  }

  return [approveCall, depositCall, sweepCall]
}
