import { encodeFunctionData, erc20Abi, maxUint256, type Address } from 'viem'
import { DeltaCallType } from '@1delta/lib-utils'
import type { ActionCall } from '../../shared/types'
import { STELLA_STDOT_ADDRESS, STELLA_STAKING_NATIVE_ADDRESS, STELLA_STGLMR_ADDRESS } from './consts'
import type { ActionCallBuilder } from '../../shared/types'
import { STELLA_STAKING_ABI, STELLA_STAKING_NATIVE_ABI } from './abi'

export type StellaStakingCallBuilderParams = {
  userAddress: Address
  tokenType: 'DOT' | 'GLMR'
  xcDOTAddress: Address
}

export const buildCalls: ActionCallBuilder<StellaStakingCallBuilderParams> = async ({
  userAddress,
  tokenType,
  xcDOTAddress,
}) => {
  if (tokenType === 'DOT') {
    const approveCall: ActionCall = {
      callType: DeltaCallType.DEFAULT,
      target: xcDOTAddress,
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
      tokenAddress: xcDOTAddress,
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
  } else {
    const depositCall: ActionCall = {
      callType: DeltaCallType.FULL_NATIVE_BALANCE,
      target: STELLA_STAKING_NATIVE_ADDRESS,
      callData: encodeFunctionData({
        abi: STELLA_STAKING_NATIVE_ABI,
        functionName: 'deposit',
        args: [],
      }),
      gasLimit: 600000n,
    }

    const sweepCall: ActionCall = {
      callType: DeltaCallType.FULL_TOKEN_BALANCE,
      target: STELLA_STGLMR_ADDRESS,
      callData: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [userAddress, 0n],
      }),
      value: 0n,
      tokenAddress: STELLA_STGLMR_ADDRESS,
      balanceOfInjectIndex: 1,
      gasLimit: 600000n,
    }

    return [depositCall, sweepCall]
  }
}
