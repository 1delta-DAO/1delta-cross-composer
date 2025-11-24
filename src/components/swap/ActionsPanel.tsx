import type { Address, Hex } from "viem"
import DestinationActionSelector from "../DestinationActionSelector"
import type { RawCurrency } from "../../types/currency"
import { DestinationActionHandler } from "../actions/shared/types"

type ActionsPanelProps = {
  dstCurrency?: RawCurrency
  userAddress?: Address
  currentChainId: number
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: DestinationActionHandler
}

export function ActionsPanel({ dstCurrency, userAddress, tokenLists, setDestinationInfo }: ActionsPanelProps) {
  return (
    <div className="card bg-base-200 shadow-lg border border-primary/30 mt-4">
      <div className="card-body">
        <div className="font-medium mb-3">Destination Actions</div>

        <DestinationActionSelector
          dstCurrency={dstCurrency}
          userAddress={userAddress}
          tokenLists={tokenLists}
          setDestinationInfo={setDestinationInfo}
        />
      </div>
    </div>
  )
}
