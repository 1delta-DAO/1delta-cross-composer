import type { Hex } from "viem"
import type { DestinationActionConfig } from "../../../../lib/types/destinationAction"
import type { MoonwellMarket } from "../../../../lib/moonwell/marketCache"

type MarketTokenCardProps = {
  market: MoonwellMarket
  depositAction: DestinationActionConfig | undefined
  onActionClick: (config: DestinationActionConfig, selector: Hex) => void
}

function DepositCard({ market, depositAction, onActionClick }: MarketTokenCardProps) {
  return (
    <div className="card bg-base-100 border border-base-300 hover:border-primary/50 transition-colors group">
      <div className="card-body p-3">
        <div className="font-medium text-sm mb-2">{market.symbol || "Unknown"}</div>
        <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {depositAction && depositAction.defaultFunctionSelector && !market.mintPaused && (
            <button
              className="btn btn-xs btn-primary flex-1"
              onClick={(e) => {
                e.stopPropagation()
                onActionClick(depositAction, depositAction.defaultFunctionSelector!)
              }}
            >
              Deposit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { DepositCard }
