import { registerAction } from '../shared/actionRegistry'
import { SwapPanel } from './SwapPanel'
import { SwapIcon } from './SwapIcon'
import type { ActionDefinition } from '../shared/actionDefinitions'

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
    }),
  }

  registerAction(swapAction)
}
