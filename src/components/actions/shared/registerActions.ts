import { registerDepositAction } from '../lending/deposit/registerDeposit'
import { registerWithdrawAction } from '../lending/withdraw/registerWithdraw'
import { registerStakingAction } from '../staking/stella/registerStaking'

export function registerActions(): void {
  registerDepositAction()
  registerWithdrawAction()
  registerStakingAction()
}
