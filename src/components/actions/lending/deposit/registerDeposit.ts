import { registerAction } from '../../shared/actionRegistry'
import { DepositPanel } from './DepositPanel'
import { DepositIcon } from './DepositIcon'
import type { ActionDefinition, ActionLoaderContext } from '../../shared/actionDefinitions'
import {
  getCachedMarkets,
  isMarketsReady,
  subscribeToCacheChanges,
  type MoonwellMarket,
} from './marketCache'
import { LendingCheckout } from './Checkout'

async function waitForMarkets(): Promise<MoonwellMarket[]> {
  return new Promise((resolve) => {
    if (isMarketsReady()) {
      const markets = getCachedMarkets()
      resolve(markets || [])
      return
    }

    const unsubscribe = subscribeToCacheChanges(() => {
      if (isMarketsReady()) {
        const markets = getCachedMarkets()
        unsubscribe()
        resolve(markets || [])
      }
    })
  })
}

export function registerDepositAction(): void {
  const depositAction: ActionDefinition = {
    id: 'moonwell_deposit',
    label: 'Moonwell Deposit',
    category: 'lending',
    icon: DepositIcon,
    panel: DepositPanel,
    priority: 1,
    actionType: 'lending',
    dataLoader: async (_context: ActionLoaderContext): Promise<MoonwellMarket[]> => {
      return await waitForMarkets()
    },
    buildPanelProps: (context) => ({
      setDestinationInfo: context.setDestinationInfo,
      chainId: context.dstCurrency?.chainId,
      destinationInfo: context.destinationInfo,
      markets: context.actionData,
    }),
    customSummary: LendingCheckout,
  }

  registerAction(depositAction)
}
