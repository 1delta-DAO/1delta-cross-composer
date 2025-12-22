import { parseUnits, type Address } from 'viem'
import { DeltaCallType, LendingCall, Lender } from '@1delta/lib-utils'
import type { ActionCall } from '../../shared/types'
import type { RawCurrency } from '../../../../types/currency'
import type { ActionCallBuilder } from '../../shared/types'
import { MOONWELL_UNDERLYING_TO_MTOKEN } from './consts'

export type WithdrawCallBuilderParams = {
  amountHuman: string
  underlying: RawCurrency
  userAddress: Address
  isMax?: boolean
}

export const buildCalls: ActionCallBuilder<WithdrawCallBuilderParams> = async ({
  amountHuman,
  underlying,
  userAddress,
  isMax = false,
}) => {
  const amountRaw = isMax ? 0n : parseUnits(amountHuman, underlying.decimals)
  const mTokenAddress = MOONWELL_UNDERLYING_TO_MTOKEN[underlying.address]

  if (!mTokenAddress) {
    throw new Error(`No mToken found for underlying ${underlying.address}`)
  }

  const withdrawCall: ActionCall & LendingCall.WithdrawToForwarderCall = {
    callType: DeltaCallType.LENDING,
    lendingAction: LendingCall.DeltaCallLendingAction.WITHDRAW,
    lender: Lender.MOONWELL,
    chainId: underlying.chainId,
    tokenAddress: underlying.address,
    amount: amountRaw,
    useOverride: {
      pool: mTokenAddress,
      collateralToken: mTokenAddress,
    },
  }

  return [withdrawCall]
}
