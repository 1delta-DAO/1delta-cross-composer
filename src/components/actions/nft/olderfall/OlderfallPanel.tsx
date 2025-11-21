// ./actions/nft/olderfall/OlderfallPanel.tsx

import { useMemo, useState } from "react"
import type { Hex } from "viem"
import type { DestinationActionConfig } from "../../../../lib/types/destinationAction"
import { getAllActions } from "../../../../lib/actions/registry"
import { useOlderfallListings } from "./hooks/useOlderfallListings"
import { SupportedChainId } from "../../../../sdk/types"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"
import { getTokenFromCache } from "../../../../lib/data/tokenListsCache"
import { DestinationActionHandler } from "../../shared/types"

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals?: number }>>

interface OlderfallPanelProps {
  dstToken?: string
  dstChainId?: string
  userAddress?: string
  tokenLists?: TokenListsMeta
  onAdd?: (config: DestinationActionConfig, selector: Hex, args: any[], value?: string) => void
  setDestinationInfo?: DestinationActionHandler
}

/* ---------- helpers & subcomponents (same as before) ---------- */

function formatListingPriceLabel(listing: any, tokenChainId: string | number | undefined, tokenLists?: TokenListsMeta): string {
  const tokenMeta = tokenLists && tokenChainId && listing.currency ? tokenLists[tokenChainId]?.[listing.currency.toLowerCase()] : undefined

  const decimals = typeof tokenMeta?.decimals === "number" ? tokenMeta.decimals : listing.priceDecimals
  const symbol = tokenMeta?.symbol || "TOKEN"

  try {
    const base = BigInt(listing.pricePerToken)
    const d = BigInt(decimals >= 0 ? decimals : 0)
    const denom = 10n ** d
    const whole = base / denom
    const frac = base % denom

    let fracStr = decimals > 0 ? frac.toString().padStart(Number(d), "0") : ""
    if (fracStr) {
      fracStr = fracStr.replace(/0+$/, "")
    }

    const human = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
    return `${human} ${symbol}`
  } catch {
    return `${listing.pricePerToken} ${symbol}`
  }
}

function buildCurrencyMetaForListing(listing: any, dstChainId?: string, tokenLists?: TokenListsMeta) {
  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM
  const tokenMeta = tokenLists && tokenChainId && listing.currency ? tokenLists[tokenChainId]?.[listing.currency.toLowerCase()] : undefined

  const cachedToken = getTokenFromCache(tokenChainId, listing.currency)

  const currency: {
    chainId: string
    address: string
    symbol?: string
    decimals: number
  } = cachedToken
    ? {
        chainId: cachedToken.chainId,
        address: cachedToken.address,
        symbol: cachedToken.symbol,
        decimals: cachedToken.decimals,
      }
    : tokenMeta
    ? {
        chainId: tokenChainId,
        address: listing.currency,
        symbol: tokenMeta.symbol,
        decimals: tokenMeta.decimals ?? listing.priceDecimals,
      }
    : {
        chainId: tokenChainId,
        address: listing.currency,
        decimals: listing.priceDecimals,
      }

  const minDstAmount = CurrencyHandler.fromRawAmount(currency, listing.pricePerToken)

  return { currency, minDstAmount }
}

function OlderfallHeader() {
  return <div className="font-semibold text-sm">Olderfall NFTs</div>
}

function OlderfallLoadingState() {
  return (
    <div className="flex items-center gap-2 text-xs opacity-70">
      <span className="loading loading-spinner loading-xs" />
      <span>Loading listings from Sequence…</span>
    </div>
  )
}

function OlderfallEmptyState() {
  return <div className="text-xs opacity-70">No Olderfall listings found or Sequence API not configured.</div>
}

interface OlderfallListingCardProps {
  listing: any
  title: string
  priceLabel: string
  isSelected: boolean
  onSelect: () => void
}

function OlderfallListingCard({ listing, title, priceLabel, isSelected, onSelect }: OlderfallListingCardProps) {
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

/* ---------- Main panel ---------- */

export function OlderfallPanel({ dstToken, dstChainId, userAddress, tokenLists, onAdd }: OlderfallPanelProps) {
  const [selectedOlderfallOrderId, setSelectedOlderfallOrderId] = useState<string>("")

  // Get Olderfall actions fully inside this component
  const allActions = useMemo(() => getAllActions({ dstToken, dstChainId }), [dstToken, dstChainId])

  const olderfallActions = useMemo(() => allActions.filter((a) => a.group === "olderfall_nft"), [allActions])

  const hasOlderfall = olderfallActions.length > 0

  const { listings: olderfallListings, loading: olderfallLoading } = useOlderfallListings(hasOlderfall, dstChainId)

  // If no actions or no onAdd callback, don't render anything
  if (!hasOlderfall) {
    return null
  }

  const handleAddClick = () => {
    if (!selectedOlderfallOrderId || !userAddress) return

    // Pick the first Olderfall config (they all share the same group)
    const cfg = olderfallActions.find((a) => a.group === "olderfall_nft") ?? olderfallActions[0]
    const listing = olderfallListings.find((l) => l.orderId === selectedOlderfallOrderId)

    if (!cfg || !listing) return

    const selector = (cfg.defaultFunctionSelector as Hex) || (cfg.functionSelectors[0] as Hex) || ("0x" as Hex)

    const args: any[] = [
      BigInt(selectedOlderfallOrderId),
      1n,
      userAddress,
      [],
      [],
      BigInt(listing.tokenId),
      listing.currency,
      listing.pricePerToken,
      listing.tokenContract,
    ]

    const { minDstAmount } = buildCurrencyMetaForListing(listing, dstChainId, tokenLists)

    const cfgWithMeta: DestinationActionConfig = {
      ...cfg,
      meta: {
        ...(cfg.meta || {}),
        sequenceCurrency: listing.currency,
        sequencePricePerToken: listing.pricePerToken,
        sequenceTokenId: listing.tokenId,
        sequencePriceDecimals: listing.priceDecimals,
        minDstAmount,
        minDstAmountBufferBps: 30,
      } as any,
    }

    onAdd?.(cfgWithMeta, selector, args, "0")
    // setDestinationInfo(...)
    setSelectedOlderfallOrderId("")
  }

  return (
    <div className="space-y-2">
      <OlderfallHeader />

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

          <button className="btn btn-primary" disabled={!selectedOlderfallOrderId || !userAddress} onClick={handleAddClick}>
            Add
          </button>
        </div>
      ) : (
        <OlderfallEmptyState />
      )}
    </div>
  )
}
