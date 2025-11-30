import { registerAction } from '../../shared/actionRegistry'
import { OlderfallPanel } from './OlderfallPanel'
import { NftIcon } from './NftIcon'
import type { ActionDefinition } from '../../shared/actionDefinitions'
import { fetchOlderfallListings } from './api'
import type { OlderfallListing } from './api'
import type { ActionLoaderContext } from '../../shared/actionDefinitions'
import { getCachedListings, setCachedListings } from './cache'
import { OLDERFALL_SUPPORTED_CHAINS } from './constants'

async function loadListings(
  _context: ActionLoaderContext
): Promise<Record<string, OlderfallListing[]>> {
  const supportedChains = OLDERFALL_SUPPORTED_CHAINS
  const results: Record<string, OlderfallListing[]> = {}

  await Promise.all(
    supportedChains.map(async (chainId) => {
      try {
        const cached = getCachedListings(chainId)
        if (cached) {
          results[chainId] = cached
          return
        }

        const listings = await fetchOlderfallListings(chainId)
        setCachedListings(chainId, listings)
        results[chainId] = listings
      } catch (error) {
        console.error(`Failed to load Olderfall listings for chain ${chainId}:`, error)
        results[chainId] = []
      }
    })
  )

  return results
}

export function registerNftAction(): void {
  const nftAction: ActionDefinition = {
    id: 'olderfall_nfts',
    label: 'Olderfall NFTs',
    category: 'gaming',
    icon: NftIcon,
    panel: OlderfallPanel,
    priority: 2,
    actionType: 'game_token',
    dataLoader: loadListings,
    buildPanelProps: (context) => ({
      setDestinationInfo: context.setDestinationInfo,
      preloadedListings: context.actionData,
    }),
  }

  registerAction(nftAction)
}
