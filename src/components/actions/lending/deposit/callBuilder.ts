import { parseUnits, type Address } from 'viem'
import { DeltaCallType, LendingCall, Lender } from '@1delta/lib-utils'
import type { ActionCall } from '../../shared/types'
import type { RawCurrency } from '../../../../types/currency'
import type { ActionCallBuilder } from '../../shared/types'
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
  const mTokenAddress = MOONWELL_UNDERLYING_TO_MTOKEN[underlying.address]

  if (!mTokenAddress) {
    throw new Error(`No mToken found for underlying ${underlying.address}`)
  }

  const depositCall: ActionCall & LendingCall.DepositCall = {
    callType: DeltaCallType.LENDING,
    lendingAction: LendingCall.DeltaCallLendingAction.DEPOSIT,
    lender: Lender.MOONWELL,
    chainId: underlying.chainId,
    tokenAddress: underlying.address,
    amount: amountRaw,
    receiver: userAddress,
    useOverride: {
      pool: mTokenAddress,
    },
  }

  return [depositCall]
}
