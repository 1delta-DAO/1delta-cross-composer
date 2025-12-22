import { registerAction } from '../../shared/actionRegistry'
import { WithdrawPanel } from './WithdrawPanel'
import { WithdrawIcon } from './WithdrawIcon'
import type { ActionDefinition, ActionLoaderContext } from '../../shared/actionDefinitions'
import {
  getCachedMarkets,
  isMarketsReady,
  subscribeToCacheChanges,
  type MoonwellMarket,
} from '../deposit/marketCache'
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

export function registerWithdrawAction(): void {
  const withdrawAction: ActionDefinition = {
    id: 'moonwell_withdraw',
    label: 'Moonwell Withdraw',
    category: 'lending',
    icon: WithdrawIcon,
    panel: WithdrawPanel,
    priority: 1,
    actionType: 'lending',
    actionDirection: 'input',
    dataLoader: async (_context: ActionLoaderContext): Promise<MoonwellMarket[]> => {
      return await waitForMarkets()
    },
    buildPanelProps: (context) => ({
      setActionInfo: context.setActionInfo,
      chainId: context.srcCurrency?.chainId,
      actionInfo: context.actionInfo,
      markets: context.actionData,
    }),
    customSummary: LendingCheckout,
  }

  registerAction(withdrawAction)
}
