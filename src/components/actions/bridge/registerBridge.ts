import { registerAction } from '../shared/actionRegistry'
import { BridgePanel } from './BridgePanel'
import { BridgeIcon } from './BridgeIcon'
import type { ActionDefinition } from '../shared/actionDefinitions'
import { CurrencyReceiveCheckout } from '../shared/CurrencyReceiptCheckout'

export function registerBridgeAction(): void {
  const bridgeAction: ActionDefinition = {
    id: 'bridge',
    label: 'Bridge',
    category: 'defi',
    icon: BridgeIcon,
    panel: BridgePanel,
    priority: 3,
    actionType: 'lending',
    requiresSrcCurrency: true,
    buildPanelProps: (context) => ({
      setActionInfo: context.setActionInfo,
      srcCurrency: context.srcCurrency,
      dstCurrency: context.dstCurrency,
      slippage: context.slippage,
      quotes: context.quotes,
      selectedQuoteIndex: context.selectedQuoteIndex,
      setSelectedQuoteIndex: context.setSelectedQuoteIndex,
    }),
    customSummary: CurrencyReceiveCheckout,
  }

  registerAction(bridgeAction)
}
