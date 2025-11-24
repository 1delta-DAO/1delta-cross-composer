import { DestinationActionConfig, DestinationCall } from "../../../lib/types/destinationAction"
import { RawCurrencyAmount } from "../../../types/currency"

/** Parameterize this handler to configure a destination action */
export type DestinationActionHandler = (
  currencyAmount: RawCurrencyAmount | undefined,
  receiverAddress: string | undefined,
  destinationCalls: DestinationCall[],
) => void

export type PendingAction = {
  id: string
  config: DestinationActionConfig
  selector: string
  args: any[]
  value?: string
}

export type DestinationCallBuilder<TParams> = (params: TParams) => Promise<DestinationCall[]>
