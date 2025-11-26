import { registerAction } from '../../shared/actionRegistry'
import { StellaStakingPanel } from './StellaStakingPanel'
import { StakingIcon } from './StakingIcon'
import type { ActionDefinition } from '../../shared/actionDefinitions'

export function registerStakingAction(): void {
  const stakingAction: ActionDefinition = {
    id: 'staking',
    label: 'Staking',
    category: 'yield',
    icon: StakingIcon,
    panel: StellaStakingPanel,
    priority: 5,
    actionType: 'staking',
    requiresExactDestinationAmount: false,
    buildPanelProps: (context) => ({
      tokenLists: context.tokenLists,
      setDestinationInfo: context.setDestinationInfo,
      srcCurrency: context.srcCurrency,
      dstCurrency: context.dstCurrency,
      slippage: context.slippage,
    }),
  }

  registerAction(stakingAction)
}
