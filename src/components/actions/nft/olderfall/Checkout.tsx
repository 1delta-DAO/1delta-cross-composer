import { Logo } from '../../../common/Logo'
import { getChainLogo } from '@1delta/lib-utils'
import { useActionData } from '../../../../contexts/DestinationInfoContext'
import { useChainsRegistry } from '../../../../sdk/hooks/useChainsRegistry'
import { useMemo } from 'react'

interface NFTCheckoutProps {
  formattedOutput?: string
  currency?: any
  outputUsd?: number
  actionLabel?: string
  actionDirection?: 'input' | 'destination'
  dstCurrency?: any
  destinationActionLabel?: string
}

export function NFTCheckout({}: NFTCheckoutProps) {
  const actionData = useActionData()
  const { data: chains } = useChainsRegistry()

  if (!actionData || !actionData.listing) return null

  const { listing, title, priceLabel } = actionData
  const chainId = actionData.chainId
  const chainLogo = getChainLogo(chainId)

  const chainName = useMemo(() => {
    if (!chainId || !chains) return chainId
    return chains[chainId]?.data?.name || chainId
  }, [chainId, chains])

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
      {chainName && (
        <div className="flex items-center gap-1 text-xs opacity-70">
          <span>on {chainName}</span>
          {chainLogo && (
            <Logo
              src={chainLogo}
              alt={chainName}
              className="h-4 w-4 rounded-full"
              fallbackText={chainName[0]}
            />
          )}
        </div>
      )}
    </div>
  )
}
