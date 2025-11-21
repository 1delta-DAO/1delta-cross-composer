// ./actions/nft/olderfall/OlderfallPanel.tsx

import { useEffect, useMemo, useState } from "react"
import { getAllActions } from "../../../../lib/actions/registry"
import { useOlderfallListings } from "./hooks/useOlderfallListings"
import { CurrencyHandler, SupportedChainId } from "../../../../sdk/types"
import { DestinationActionHandler } from "../../shared/types"
import { Chain } from "@1delta/chain-registry"
import { OlderfallListingCard } from "./OlderfallCard"
import { formatListingPriceLabel } from "./utils"
import { OlderfallEmptyState, OlderfallHeader, OlderfallLoadingState } from "./Generic"
import { buildCalls } from "./callBuilder"

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals: number; address: string; chainId: string }>>

interface OlderfallPanelProps {
  userAddress?: string
  tokenLists?: TokenListsMeta
  setDestinationInfo?: DestinationActionHandler
}

interface OlderfallListingsListProps {
  listings: any[]
  dstChainId?: string | number
  tokenLists?: TokenListsMeta
  selectedOrderId: string
  onSelectOrderId: (orderId: string) => void
}

function OlderfallListingsList({ listings, dstChainId, tokenLists, selectedOrderId, onSelectOrderId }: OlderfallListingsListProps) {
  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {listings.map((l) => {
        const isSelected = selectedOrderId === l.orderId
        const priceLabel = formatListingPriceLabel(l, tokenChainId, tokenLists)
        const title = l.name || `Armor #${l.tokenId}`

        return (
          <OlderfallListingCard
            key={l.orderId}
            listing={l}
            title={title}
            priceLabel={priceLabel}
            isSelected={isSelected}
            onSelect={() => onSelectOrderId(l.orderId)}
          />
        )
      })}
    </div>
  )
}

/* ---------- Options that parameterize the panel ---------- */

const OLDERFALL_OPTIONS = [
  {
    chainId: Chain.POLYGON_MAINNET,
    token: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    label: "Polygon",
  },
  {
    chainId: Chain.MOONBEAM,
    token: "0xffffffff7d2b0b761af01ca8e25242976ac0ad7d",
    label: "Moonbeam",
  },
]

/* ---------- Main unified panel with tabs ---------- */

export function OlderfallPanel({ userAddress, tokenLists, setDestinationInfo }: OlderfallPanelProps) {
  const [selectedOlderfallOrderId, setSelectedOlderfallOrderId] = useState<string>("")
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)

  const selectedOption = OLDERFALL_OPTIONS[selectedOptionIndex]
  const dstChainId = String(selectedOption.chainId)

  // Reset selected listing when switching chain
  useEffect(() => {
    setSelectedOlderfallOrderId("")
  }, [selectedOptionIndex])

  const { listings: olderfallListings, loading: olderfallLoading } = useOlderfallListings(true, dstChainId)

  const handleAddClick = async () => {
    if (!selectedOlderfallOrderId || !userAddress) return

    // Pick the first Olderfall config (they all share the same group)
    const listing = olderfallListings.find((l) => l.orderId === selectedOlderfallOrderId)

    if (!listing) return

    // read selected option
    const { chainId, token } = selectedOption

    // create calldata
    const destinationCalls = await buildCalls({
      chainId: chainId,
      buyer: userAddress as any,
      listing,
    })
    setDestinationInfo?.(
      // define output amount
      CurrencyHandler.fromRawAmount(
        tokenLists?.[chainId]?.[token.toLowerCase()]!,
        listing.pricePerToken // amount to pay
      ),
      undefined, // intermediate receiver: default
      destinationCalls
    )
    setSelectedOlderfallOrderId("")
  }

  return (
    <div className="space-y-3">
      <OlderfallHeader />

      {/* Chain tabs driven by OLDERFALL_OPTIONS */}
      <div className="tabs tabs-boxed text-xs">
        {OLDERFALL_OPTIONS.map((opt, idx) => (
          <button
            key={`${opt.chainId}-${opt.token}`}
            type="button"
            className={`tab ${idx === selectedOptionIndex ? "tab-active" : ""}`}
            onClick={() => setSelectedOptionIndex(idx)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {olderfallLoading ? (
        <OlderfallLoadingState />
      ) : olderfallListings.length > 0 ? (
        <div className="space-y-2">
          <OlderfallListingsList
            listings={olderfallListings}
            dstChainId={dstChainId}
            tokenLists={tokenLists}
            selectedOrderId={selectedOlderfallOrderId}
            onSelectOrderId={setSelectedOlderfallOrderId}
          />

          <button className="btn btn-primary btn-sm" disabled={!selectedOlderfallOrderId || !userAddress} onClick={handleAddClick}>
            Add
          </button>
        </div>
      ) : (
        <OlderfallEmptyState />
      )}
    </div>
  )
}
