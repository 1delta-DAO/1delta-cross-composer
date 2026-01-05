import { registerSwapAction } from '../swap/registerSwap'
import { registerBridgeAction } from '../bridge/registerBridge'
import { registerDepositAction } from '../lending/deposit/registerDeposit'
import { registerWithdrawAction } from '../lending/withdraw/registerWithdraw'
import { registerStakingAction } from '../staking/stella/registerStaking'
import { registerNftAction } from '../nft/olderfall/registerNft'

export function registerActions(): void {
  registerSwapAction()
  registerBridgeAction()
  registerDepositAction()
  registerWithdrawAction()
  registerStakingAction()
  registerNftAction()
}
