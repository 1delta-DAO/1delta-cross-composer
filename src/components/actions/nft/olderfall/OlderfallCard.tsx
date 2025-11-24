import type { Hex } from "viem"
import type { DestinationActionConfig } from "../../../../lib/types/destinationAction"

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals?: number }>>

interface OlderfallPanelProps {
  actions: DestinationActionConfig[]
  dstChainId?: string
  userAddress?: string
  tokenLists?: TokenListsMeta
  onAdd?: (config: DestinationActionConfig, selector: Hex, args: any[], value?: string) => void
}

interface OlderfallListingCardProps {
  listing: any
  title: string
  priceLabel: string
  isSelected: boolean
  onSelect: () => void
}

export function OlderfallListingCard({ listing, title, priceLabel, isSelected, onSelect }: OlderfallListingCardProps) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-3 p-2 rounded border ${isSelected ? "border-primary bg-primary/10" : "border-base-300"}`}
      onClick={onSelect}
    >
      {listing.image && (
        <div className="w-10 h-10 rounded overflow-hidden bg-base-300 shrink-0">
          <img src={listing.image} alt={title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex flex-col items-start text-left">
        <div className="text-sm font-medium truncate max-w-[200px]">{title}</div>
        <div className="text-xs opacity-70">#{listing.tokenId}</div>
        <div className="text-xs font-semibold">{priceLabel}</div>
      </div>
    </button>
  )
}
