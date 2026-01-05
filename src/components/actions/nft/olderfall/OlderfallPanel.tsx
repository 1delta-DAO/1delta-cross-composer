import { useEffect, useState } from 'react'
import { CurrencyHandler, SupportedChainId } from '../../../../sdk/types'
import { ActionHandler as ActionHandler } from '../../shared/types'
import { Chain } from '@1delta/chain-registry'
import { OlderfallListingCard } from './OlderfallCard'
import { formatListingPriceLabel } from './utils'
import { buildCalls } from './callBuilder'
import type { OlderfallListing } from './api'
import { useConnection } from 'wagmi'
import type { Address } from 'viem'
import { getTokenFromCache, isTokenListsReady } from '../../../../lib/data/tokenListsCache'
import { isEmptyAddress, isValidAddress } from '../../../../utils/validatorUtils'

interface OlderfallPanelProps {
  setActionInfo?: ActionHandler
  preloadedListings?: Record<string, OlderfallListing[]>
  resetKey?: number
}

interface OlderfallListingsListProps {
  listings: any[]
  dstChainId?: string | number
  selectedOrderId: string
  onSelectOrderId: (orderId: string) => void
}

export function OlderfallHeader() {
  return <div className="font-semibold text-sm">Olderfall NFTs</div>
}

export function OlderfallLoadingState() {
  return (
    <div className="flex items-center gap-2 text-xs opacity-70">
      <span className="loading loading-spinner loading-xs" />
      <span>Loading listings from Sequence…</span>
    </div>
  )
}

export function OlderfallEmptyState() {
  return (
    <div className="text-xs opacity-70">
      No Olderfall listings found or Sequence API not configured.
    </div>
  )
}

function OlderfallListingsList({
  listings,
  dstChainId,
  selectedOrderId,
  onSelectOrderId,
}: OlderfallListingsListProps) {
  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM

  return (
    <div className="grid grid-cols-1 min-[600px]:grid-cols-2 min-[800px]:grid-cols-3 min-[1000px]:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
      {listings.map((l) => {
        const isSelected = selectedOrderId === l.orderId
        const priceLabel = formatListingPriceLabel(l, tokenChainId)
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
    token: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    label: 'Polygon',
  },
  {
    chainId: Chain.MOONBEAM,
    token: '0xffffffff7d2b0b761af01ca8e25242976ac0ad7d',
    label: 'Moonbeam',
  },
]

/* ---------- Main unified panel with tabs ---------- */

export function OlderfallPanel({
  setActionInfo,
  preloadedListings,
  resetKey,
}: OlderfallPanelProps) {
  const { address } = useConnection()
  const [selectedOlderfallOrderId, setSelectedOlderfallOrderId] = useState<string>('')
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)
  const [receiverAddress, setReceiverAddress] = useState<string>('')

  const selectedOption = OLDERFALL_OPTIONS[selectedOptionIndex]
  const dstChainId = String(selectedOption.chainId)

  const receiverAddressValid = isEmptyAddress(receiverAddress) || isValidAddress(receiverAddress)
  const finalReceiverAddress = isEmptyAddress(receiverAddress)
    ? address
    : isValidAddress(receiverAddress)
      ? (receiverAddress as Address)
      : address

  // Reset selected listing when switching chain
  useEffect(() => {
    setSelectedOlderfallOrderId('')
  }, [selectedOptionIndex])

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setSelectedOlderfallOrderId('')
      setSelectedOptionIndex(0)
      setReceiverAddress('')
      setActionInfo?.(undefined, undefined, [])
    }
  }, [resetKey])

  const olderfallListings = preloadedListings?.[dstChainId] ?? []
  const olderfallLoading = !preloadedListings

  const handleAddClick = async (selectedOlderfallOrderId: string) => {
    if (!selectedOlderfallOrderId || !address) return

    if (!receiverAddressValid || !finalReceiverAddress) return

    if (!isTokenListsReady()) return

    // Pick the first Olderfall config (they all share the same group)
    const listing = olderfallListings.find((l) => l.orderId === selectedOlderfallOrderId)

    if (!listing) return

    const { chainId } = selectedOption

    const purchaseTokenData = getTokenFromCache(dstChainId, listing.currency)
    if (!purchaseTokenData) return

    // create calldata
    const destinationCalls = await buildCalls({
      chainId: chainId,
      buyer: finalReceiverAddress,
      userAddress: address,
      listing,
    })
    const nftName = listing.name || `NFT #${listing.tokenId}`

    setActionInfo?.(
      // define output amount
      CurrencyHandler.fromRawAmount(
        purchaseTokenData,
        listing.pricePerToken // amount to pay
      ),
      undefined, // intermediate receiver: default
      destinationCalls,
      nftName,
      undefined,
      {
        listing,
        title: formatListingPriceLabel(listing, purchaseTokenData.chainId),
        priceLabel: nftName,
        chainId: purchaseTokenData.chainId,
      }
    )
    setSelectedOlderfallOrderId('')
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
            className={`tab ${idx === selectedOptionIndex ? 'tab-active' : ''}`}
            onClick={() => setSelectedOptionIndex(idx)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text text-xs font-medium">Receiver Address (optional)</span>
        </label>
        <input
          type="text"
          value={receiverAddress}
          onChange={(e) => setReceiverAddress(e.target.value)}
          placeholder={address || '0x...'}
          className={`input input-bordered input-sm w-full ${!receiverAddressValid ? 'input-error' : ''}`}
        />
        {!receiverAddressValid && (
          <label className="label">
            <span className="label-text-alt text-error">Invalid Ethereum address</span>
          </label>
        )}
        {isEmptyAddress(receiverAddress) && (
          <label className="label">
            <span className="label-text-alt opacity-70">Leave empty to use your address</span>
          </label>
        )}
      </div>

      {olderfallLoading ? (
        <OlderfallLoadingState />
      ) : olderfallListings.length > 0 ? (
        <OlderfallListingsList
          listings={olderfallListings}
          dstChainId={dstChainId}
          selectedOrderId={selectedOlderfallOrderId}
          onSelectOrderId={async (id) => {
            setSelectedOlderfallOrderId(id)
            await handleAddClick(id)
          }}
        />
      ) : (
        <OlderfallEmptyState />
      )}
    </div>
  )
}
