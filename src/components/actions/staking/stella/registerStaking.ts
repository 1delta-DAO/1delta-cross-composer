import { registerAction } from '../../shared/actionRegistry'
import { StellaStakingPanel } from './StellaStakingPanel'
import { StakingIcon } from './StakingIcon'
import type { ActionDefinition } from '../../shared/actionDefinitions'
import { StakingCheckout } from './Checkout'

export function registerStakingAction(): void {
  const stakingAction: ActionDefinition = {
    id: 'staking',
    label: 'Staking',
    category: 'yield',
    icon: StakingIcon,
    panel: StellaStakingPanel,
    priority: 5,
    actionType: 'staking',
    buildPanelProps: (context) => ({
      setDestinationInfo: context.setDestinationInfo,
      srcCurrency: context.srcCurrency,
      dstCurrency: context.dstCurrency,
      slippage: context.slippage,
    }),
    customSummary: StakingCheckout,
  }

  registerAction(stakingAction)
}
