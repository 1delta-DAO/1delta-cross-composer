import { GenericTrade } from '@1delta/lib-utils'

export function isBridge(trade?: GenericTrade) {
  return trade?.inputAmount.currency.chainId !== trade?.outputAmount.currency.chainId
}
