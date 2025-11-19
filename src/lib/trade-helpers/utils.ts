import { type Address, zeroAddress } from "viem"
import { getTokenFromCache } from "../data/tokenListsCache"
import type { RawCurrency } from "@1delta/lib-utils"
import { chains } from "@1delta/data-sdk"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"

export function getCurrency(chainId: string, tokenAddress: Address | undefined): RawCurrency | undefined {
  if (!tokenAddress || !chainId) {
    return undefined
  }

  if (tokenAddress.toLowerCase() === zeroAddress.toLowerCase()) {
    const chainInfo = chains()?.[chainId]
    if (!chainInfo?.nativeCurrency) return undefined
    const { symbol, name, decimals } = chainInfo.nativeCurrency
    return {
      chainId: chainId,
      address: zeroAddress,
      symbol,
      name,
      decimals,
    }
  }

  const token = getTokenFromCache(chainId, tokenAddress)
  return token
}

export function convertAmountToWei(amount: string, decimals: number): string {
  try {
    const num = Number(amount)
    if (isNaN(num) || num <= 0) {
      return "0"
    }
    const parts = amount.split(".")
    const integerPart = parts[0] || "0"
    const decimalPart = parts[1] || ""
    const paddedDecimal = decimalPart.padEnd(decimals, "0").slice(0, decimals)
    const fullAmount = integerPart + paddedDecimal

    return BigInt(fullAmount).toString()
  } catch {
    return "0"
  }
}
