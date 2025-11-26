import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hex } from 'viem'
import { DeltaCallType } from '@1delta/trade-sdk/dist/types'
import { ComposerLendingActions, TransferToLenderType } from '@1delta/calldata-sdk'
import type { DestinationCall } from '../../../../lib/types/destinationAction'
import type { RawCurrency } from '../../../../types/currency'
import type { DestinationCallBuilder } from '../../shared/types'
import { encodeComposerCompose } from '../../../../lib/calldata/encodeComposerCompose'
import { MOONWELL_UNDERLYING_TO_MTOKEN } from '../../../../hooks/useMoonwellMarkets'

export type DepositCallBuilderParams = {
  amountHuman: string
  underlying: RawCurrency
  userAddress: Address
  dstChainId?: string
  composerAddress: Address
  callForwarderAddress: Address
}

export const buildCalls: DestinationCallBuilder<DepositCallBuilderParams> = async ({
  amountHuman,
  underlying,
  userAddress,
  dstChainId,
  composerAddress,
}) => {
  const amountRaw = parseUnits(amountHuman, underlying.decimals)

  const depositCall = ComposerLendingActions.createDeposit({
    receiver: userAddress,
    amount: amountRaw,
    asset: underlying.address,
    chainId: dstChainId || underlying.chainId,
    lender: 'MOONWELL' as any,
    transferType: TransferToLenderType.ContractBalance,
    useOverride: {
      pool: MOONWELL_UNDERLYING_TO_MTOKEN[underlying.address],
    },
  })

  const wrapDepositInCompose = encodeComposerCompose(depositCall as Hex)

  const transferCall: DestinationCall = {
    target: underlying.address as Address,
    calldata: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [composerAddress, 0n],
    }),
    value: 0n,
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    tokenAddress: underlying.address as Address,
    balanceOfInjectIndex: 1,
    gasLimit: 500000n,
  }

  const composerCall: DestinationCall = {
    target: composerAddress,
    calldata: wrapDepositInCompose,
    callType: DeltaCallType.FULL_NATIVE_BALANCE,
    gasLimit: 1000000n,
  }

  return [transferCall, composerCall]
}
