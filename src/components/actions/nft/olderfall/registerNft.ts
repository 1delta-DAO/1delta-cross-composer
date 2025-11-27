import { registerAction } from '../../shared/actionRegistry'
import { OlderfallPanel } from './OlderfallPanel'
import { NftIcon } from './NftIcon'
import type { ActionDefinition } from '../../shared/actionDefinitions'
import { Chain } from '@1delta/chain-registry'
import { fetchOlderfallListings } from './api'
import type { OlderfallListing } from './api'
import type { ActionLoaderContext } from '../../shared/actionDefinitions'
import { getCachedListings, setCachedListings } from './cache'

export function registerNftAction(): void {
  const nftAction: ActionDefinition = {
    id: 'olderfall_nfts',
    label: 'Olderfall NFTs',
    category: 'gaming',
    icon: NftIcon,
    panel: OlderfallPanel,
    priority: 2,
    actionType: 'game_token',
    requiresExactDestinationAmount: true,
    dataLoader: async (
      context: ActionLoaderContext
    ): Promise<Record<string, OlderfallListing[]>> => {
      const supportedChains = [String(Chain.POLYGON_MAINNET), String(Chain.MOONBEAM)]
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
    },
    buildPanelProps: (context) => ({
      tokenLists: context.tokenLists,
      setDestinationInfo: context.setDestinationInfo,
      preloadedListings: context.actionData,
    }),
  }

  registerAction(nftAction)
}
