import { Address } from 'viem'
import { Lender } from '@1delta/lib-utils'
import { getMarketByMToken } from '../../actions/lending/shared/marketCache'

export function getUnderlyingTokenFromLendingToken(
  lender: Lender,
  mToken: Address,
  providedUnderlying?: Address
): Address | undefined {
  switch (lender) {
    case Lender.MOONWELL:
      return (
        providedUnderlying ||
        (getMarketByMToken(mToken)?.underlyingCurrency.address as Address | undefined)
      )
    default:
      throw new Error(`getUnderlyingTokenFromMToken not implemented for lender: ${String(lender)}`)
  }
}

export function calculateRequiredLendingTokenAmount(
  lender: Lender,
  underlyingAmount: bigint,
  mToken: Address,
  balance: bigint
): bigint | null {
  switch (lender) {
    case Lender.MOONWELL: {
      const market = getMarketByMToken(mToken)
      if (!market) {
        return null
      }
      if (!market.exchangeRate || market.exchangeRate === 0n) {
        return null
      }
      const exchangeRate = market.exchangeRate
      const mTokenAmount = (underlyingAmount * 10n ** 18n) / exchangeRate
      const finalRequiredAmount = mTokenAmount > balance ? balance : mTokenAmount
      return finalRequiredAmount + 1n
    }
    default:
      throw new Error(`calculateRequiredMTokenAmount not implemented for lender: ${String(lender)}`)
  }
}
