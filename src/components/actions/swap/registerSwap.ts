import { registerAction } from '../shared/actionRegistry'
import { SwapPanel } from './SwapPanel'
import { SwapIcon } from './SwapIcon'
import type { ActionDefinition } from '../shared/actionDefinitions'
import { CurrencyReceiveCheckout } from '../shared/CurrencyReceiptCheckout'

export function registerSwapAction(): void {
  const swapAction: ActionDefinition = {
    id: 'swap',
    label: 'Swap',
    category: 'defi',
    icon: SwapIcon,
    panel: SwapPanel,
    priority: 4,
    actionType: 'lending',
    requiresSrcCurrency: true,
    buildPanelProps: (context) => ({
      setDestinationInfo: context.setDestinationInfo,
      srcCurrency: context.srcCurrency,
      dstCurrency: context.dstCurrency,
      quotes: context.quotes,
      selectedQuoteIndex: context.selectedQuoteIndex,
      setSelectedQuoteIndex: context.setSelectedQuoteIndex,
    }),
    customSummary: CurrencyReceiveCheckout,
  }

  registerAction(swapAction)
}
