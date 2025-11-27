import type { OlderfallListing } from './api'

interface NftMetadataModalProps {
  open: boolean
  onClose: () => void
  listing: OlderfallListing | null
}

export function NftMetadataModal({ open, onClose, listing }: NftMetadataModalProps) {
  if (!open || !listing) return null

  const metadata = listing.metadata || {}
  const description = metadata.description
  const attributes = metadata.attributes || []
  const externalUrl = metadata.external_url
  const name = listing.name || `NFT #${listing.tokenId}`
  const image = listing.image

  return (
    <div className={`modal ${open ? 'modal-open' : ''}`} onClick={onClose}>
      <div
        className="modal-box max-w-2xl max-h-[90dvh] p-0 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
          <h3 className="font-bold text-lg">NFT Metadata</h3>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="space-y-4">
            {image && (
              <div className="flex justify-center">
                <div className="w-48 h-48 rounded-lg overflow-hidden bg-base-300">
                  <img src={image} alt={name} className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-base mb-1">{name}</h4>
              <p className="text-sm text-base-content/70">Token ID: #{listing.tokenId}</p>
            </div>

            {description && (
              <div>
                <h5 className="font-medium text-sm mb-2">Description</h5>
                <p className="text-sm text-base-content/80 whitespace-pre-wrap">{description}</p>
              </div>
            )}

            {attributes.length > 0 && (
              <div>
                <h5 className="font-medium text-sm mb-2">Attributes</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attributes.map((attr, index) => {
                    const traitType = attr.trait_type || attr.TraitType || 'Attribute'
                    const value = attr.value !== undefined ? String(attr.value) : ''
                    return (
                      <div
                        key={index}
                        className="border border-base-300 rounded-lg p-2 bg-base-200/40"
                      >
                        <div className="text-xs text-base-content/60 mb-1">{traitType}</div>
                        <div className="text-sm font-medium">{value || 'N/A'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {externalUrl && (
              <div>
                <h5 className="font-medium text-sm mb-2">External Link</h5>
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {externalUrl}
                </a>
              </div>
            )}

            {!description && attributes.length === 0 && !externalUrl && (
              <div className="text-sm text-base-content/60 text-center py-4">
                No metadata available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
