import { registerAction } from '../../shared/actionRegistry'
import { DepositPanel } from './DepositPanel'
import { DepositIcon } from './DepositIcon'
import type { ActionDefinition } from '../../shared/actionDefinitions'

export function registerDepositAction(): void {
  const depositAction: ActionDefinition = {
    id: 'deposit_lending',
    label: 'Deposit (Lending)',
    category: 'lending',
    icon: DepositIcon,
    panel: DepositPanel,
    priority: 1,
    actionType: 'lending',
    requiresMarkets: true,
    requiresExactDestinationAmount: false,
    buildPanelProps: (context) => ({
      tokenLists: context.tokenLists,
      setDestinationInfo: context.setDestinationInfo,
      chainId: context.chainId,
    }),
    isReady: (context) => context.marketsReady,
  }

  registerAction(depositAction)
}
