import { useState } from 'react'
import type { OlderfallListing } from './api'
import { NftMetadataModal } from './NftMetadataModal'

interface OlderfallListingCardProps {
  listing: OlderfallListing
  title: string
  priceLabel: string
  isSelected: boolean
  onSelect: () => void
}

export function OlderfallListingCard({
  listing,
  title,
  priceLabel,
  isSelected,
  onSelect,
}: OlderfallListingCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsModalOpen(true)
  }

  return (
    <>
      <div
        className={`relative w-full flex items-center gap-3 p-2 cursor-pointer hover:border-primary/50 rounded border ${isSelected ? 'border-primary bg-primary/10' : 'border-base-300'}`}
        onClick={onSelect}
      >
        <button
          type="button"
          className="absolute top-1 right-1 btn btn-xs btn-ghost btn-circle p-0 w-5 h-5 min-h-0 opacity-70 hover:opacity-100 z-10"
          onClick={handleInfoClick}
          title="View metadata"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
        </button>
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
      </div>
      <NftMetadataModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        listing={listing}
      />
    </>
  )
}
