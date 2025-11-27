import type { GenericTrade } from '@1delta/lib-utils'

interface BridgeCardProps {
  bridge: string
  trade: GenericTrade
  outputTokenSymbol?: string
  isSelected: boolean
  onSelect: () => void
}

export function BridgeCard({
  bridge,
  trade,
  outputTokenSymbol,
  isSelected,
  onSelect,
}: BridgeCardProps) {
  const outputAmount = trade.outputAmountRealized
  const formattedOutput = outputAmount > 0 ? outputAmount.toFixed(6) : '0'

  return (
    <button
      type="button"
      className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
        isSelected ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold">{bridge.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="flex flex-col items-start text-left flex-1">
        <div className="text-sm font-semibold">{bridge}</div>
        <div className="text-xs opacity-70">
          {formattedOutput} {outputTokenSymbol || 'tokens'}
        </div>
      </div>
      {isSelected && (
        <div className="text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </button>
  )
}
