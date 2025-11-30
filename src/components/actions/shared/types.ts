import { DeltaCall } from '@1delta/lib-utils'
import type { RawCurrencyAmount } from '../../../types/currency'

export type ActionCall = DeltaCall & {
  gasLimit?: bigint
}

export type ActionHandler = (
  currencyAmount: RawCurrencyAmount | undefined,
  receiverAddress: string | undefined,
  destinationCalls: ActionCall[],
  actionLabel?: string,
  actionId?: string
) => void

export type ActionCallBuilder<TParams> = (params: TParams) => Promise<ActionCall[]>
