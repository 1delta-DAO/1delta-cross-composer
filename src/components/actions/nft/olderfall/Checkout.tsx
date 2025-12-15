import { Logo } from '../../../common/Logo'
import { getChainLogo } from '@1delta/lib-utils'
import { useActionData } from '../../../../contexts/DestinationInfoContext'

interface NFTCheckoutProps {
  dstChainName?: string
}

export function NFTCheckout({ dstChainName }: NFTCheckoutProps) {
  const actionData = useActionData()

  if (!actionData || !actionData.listing) return null

  const { listing, title, priceLabel } = actionData
  const chainLogo = getChainLogo(actionData.chainId)

  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-base-100 border border-base-300">
      <div className="text-sm font-semibold">NFT Receipt Summary</div>

      {/* NFT image + info */}
      <div className="flex items-center gap-4">
        {listing.image && (
          <div className="w-16 h-16 rounded overflow-hidden bg-base-300 shrink-0">
            <img src={listing.image} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs opacity-70">#{listing.tokenId}</div>
          <div className="text-xs font-semibold">{priceLabel}</div>
        </div>
      </div>

      {/* Chain info */}
      {dstChainName && (
        <div className="flex items-center gap-1 text-xs opacity-70">
          <span>on {dstChainName}</span>
          {chainLogo && (
            <Logo
              src={chainLogo}
              alt={dstChainName}
              className="h-4 w-4 rounded-full"
              fallbackText={dstChainName[0]}
            />
          )}
        </div>
      )}
    </div>
  )
}
