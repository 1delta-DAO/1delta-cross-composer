// ./actions/nft/olderfall/OlderfallPanel.tsx

import { useEffect, useState } from 'react'
import { CurrencyHandler, SupportedChainId } from '../../../../sdk/types'
import { DestinationActionHandler } from '../../shared/types'
import { Chain } from '@1delta/chain-registry'
import { OlderfallListingCard } from './OlderfallCard'
import { formatListingPriceLabel } from './utils'
import { OlderfallEmptyState, OlderfallHeader, OlderfallLoadingState } from './Generic'
import { buildCalls } from './callBuilder'
import type { OlderfallListing } from './api'
import type { TokenListsMeta } from './types'
import { useConnection } from 'wagmi'
import { isValidAddress, isEmptyAddress } from '../../../../utils/addressValidation'
import type { Address } from 'viem'

interface OlderfallPanelProps {
  tokenLists?: TokenListsMeta
  setDestinationInfo?: DestinationActionHandler
  preloadedListings?: Record<string, OlderfallListing[]>
  resetKey?: number
}

interface OlderfallListingsListProps {
  listings: any[]
  dstChainId?: string | number
  tokenLists?: TokenListsMeta
  selectedOrderId: string
  onSelectOrderId: (orderId: string) => void
}

function OlderfallListingsList({
  listings,
  dstChainId,
  tokenLists,
  selectedOrderId,
  onSelectOrderId,
}: OlderfallListingsListProps) {
  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM

  return (
    <div className="grid grid-cols-1 min-[600px]:grid-cols-2 min-[800px]:grid-cols-3 min-[1000px]:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
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
  tokenLists,
  setDestinationInfo,
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
      setDestinationInfo?.(undefined, undefined, [])
    }
  }, [resetKey])

  const olderfallListings = preloadedListings?.[dstChainId] ?? []
  const olderfallLoading = !preloadedListings

  const handleAddClick = async (selectedOlderfallOrderId: string) => {
    if (!selectedOlderfallOrderId || !address) return

    if (!receiverAddressValid || !finalReceiverAddress) return

    // Pick the first Olderfall config (they all share the same group)
    const listing = olderfallListings.find((l) => l.orderId === selectedOlderfallOrderId)

    if (!listing) return

    // read selected option
    const { chainId, token } = selectedOption

    // create calldata
    const destinationCalls = await buildCalls({
      chainId: chainId,
      buyer: finalReceiverAddress,
      userAddress: address,
      listing,
    })
    console.log('listing.pricePerToken', listing.pricePerToken, setDestinationInfo)
    const nftName = listing.name || `NFT #${listing.tokenId}`
    setDestinationInfo?.(
      // define output amount
      CurrencyHandler.fromRawAmount(
        tokenLists?.[chainId]?.[token.toLowerCase()]!,
        listing.pricePerToken // amount to pay
      ),
      undefined, // intermediate receiver: default
      destinationCalls,
      nftName
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
          tokenLists={tokenLists}
          selectedOrderId={selectedOlderfallOrderId}
          onSelectOrderId={async (id) => {
            await setSelectedOlderfallOrderId(id)
            await handleAddClick(id)
          }}
        />
      ) : (
        <OlderfallEmptyState />
      )}
    </div>
  )
}
