import { DeltaCall } from '@1delta/lib-utils'
import type { RawCurrencyAmount } from '../../../types/currency'

export type ActionCall = DeltaCall & {
  gasLimit?: bigint
}

export type ActionHandler = (
  currencyAmount: RawCurrencyAmount | undefined, // the purchase amount
  receiverAddress: string | undefined, // receiver address if different from sender
  destinationCalls: ActionCall[], // additional calls to be made
  actionLabel?: string,
  actionId?: string,
  actionData?: any // custom data for checkout info
) => void

export type ActionCallBuilder<TParams> = (params: TParams) => Promise<ActionCall[]>
