import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hex } from 'viem'
import { DeltaCallType } from '@1delta/lib-utils'
import {
  ComposerLendingActions,
  getComposerAddress,
  TransferToLenderType,
} from '@1delta/calldata-sdk'
import type { ActionCall } from '../../shared/types'
import type { RawCurrency } from '../../../../types/currency'
import type { ActionCallBuilder } from '../../shared/types'
import { encodeComposerCompose } from '../../../../lib/calldata/encodeComposerCompose'
import { MOONWELL_UNDERLYING_TO_MTOKEN } from './consts'

export type DepositCallBuilderParams = {
  amountHuman: string
  underlying: RawCurrency
  userAddress: Address
}

export const buildCalls: ActionCallBuilder<DepositCallBuilderParams> = async ({
  amountHuman,
  underlying,
  userAddress,
}) => {
  const amountRaw = parseUnits(amountHuman, underlying.decimals)
  const composerAddress = getComposerAddress(underlying.chainId)

  const depositCall = ComposerLendingActions.createDeposit({
    receiver: userAddress,
    amount: amountRaw,
    asset: underlying.address,
    chainId: underlying.chainId,
    lender: 'MOONWELL' as any,
    transferType: TransferToLenderType.ContractBalance,
    useOverride: {
      pool: MOONWELL_UNDERLYING_TO_MTOKEN[underlying.address],
    },
  })

  const wrapDepositInCompose = encodeComposerCompose(depositCall as Hex)

  const transferCall: ActionCall = {
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    target: underlying.address,
    callData: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [composerAddress, 0n],
    }),
    value: 0n,
    tokenAddress: underlying.address,
    balanceOfInjectIndex: 1,
    gasLimit: 500000n,
  }

  const composerCall: ActionCall = {
    callType: DeltaCallType.FULL_NATIVE_BALANCE,
    target: composerAddress,
    callData: wrapDepositInCompose,
    gasLimit: 1000000n,
  }

  return [transferCall, composerCall]
}
