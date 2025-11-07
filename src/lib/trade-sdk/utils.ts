import { type Address, zeroAddress } from "viem"
import { getTokenFromCache } from "../data/tokenListsCache"
import type { RawCurrency } from "@1delta/lib-utils"
import { chains } from "@1delta/data-sdk"

/**
 * Get RawCurrency from chainId and tokenAddress
 * Returns 1delta RawCurrency format directly
 */
export function getCurrency(chainId: string, tokenAddress: Address | undefined): RawCurrency | undefined {
    if (!tokenAddress || !chainId) {
        return undefined
    }

    // Handle native token (zero address)
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

    // Get token from cache - it should already be in 1delta format
    const token = getTokenFromCache(chainId, tokenAddress)
    return token
}

/**
 * Convert amount string to wei format (raw amount string)
 */
export function convertAmountToWei(amount: string, decimals: number): string {
    try {
        const num = Number(amount)
        if (isNaN(num) || num <= 0) {
            return "0"
        }
        // Convert to wei by multiplying by 10^decimals
        // Use parseUnits-like logic to handle decimal precision correctly
        const parts = amount.split(".")
        const integerPart = parts[0] || "0"
        const decimalPart = parts[1] || ""

        // Pad or truncate decimal part to match decimals
        const paddedDecimal = decimalPart.padEnd(decimals, "0").slice(0, decimals)
        const fullAmount = integerPart + paddedDecimal

        return BigInt(fullAmount).toString()
    } catch {
        return "0"
    }
}
