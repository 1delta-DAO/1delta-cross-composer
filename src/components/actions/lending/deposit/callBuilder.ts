import { type Address } from 'viem'
import { DeltaCallType, LendingCall, Lender } from '@1delta/lib-utils'
import type { ActionCall } from '../../shared/types'
import type { RawCurrency } from '../../../../types/currency'
import type { ActionCallBuilder } from '../../shared/types'
import { MOONWELL_UNDERLYING_TO_MTOKEN } from './consts'
import { TransferToLenderType } from '@1delta/calldata-sdk'

export type DepositCallBuilderParams = {
  amountHuman: string
  underlying: RawCurrency
  userAddress: Address
}

export const buildCalls: ActionCallBuilder<DepositCallBuilderParams> = async ({
  underlying,
  userAddress,
}) => {
  // const amountRaw = parseUnits(amountHuman, underlying.decimals)
  const mTokenAddress = MOONWELL_UNDERLYING_TO_MTOKEN[underlying.address]

  if (!mTokenAddress) {
    throw new Error(`No mToken found for underlying ${underlying.address}`)
  }

  const sweepToComposerCall: ActionCall = {
    callType: DeltaCallType.SWEEP_WITH_VALIDATION,
    tokenAddress: underlying.address,
    limit: 0n,
  }

  const depositCall: ActionCall & LendingCall.DepositCall = {
    callType: DeltaCallType.LENDING,
    lendingAction: LendingCall.DeltaCallLendingAction.DEPOSIT,
    lender: Lender.MOONWELL,
    chainId: underlying.chainId,
    tokenAddress: underlying.address,
    amount: 0n,
    receiver: userAddress,
    transferType: TransferToLenderType.ContractBalance,
    useOverride: {
      pool: mTokenAddress,
    },
  }

  return [sweepToComposerCall, depositCall]
}
