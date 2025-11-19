import type { Address } from "viem"
import { zeroAddress } from "viem"
import { CurrencyHandler } from "../../sdk/types"

// Helper function to get aggregator logo URL
export function getAggregatorLogo(aggregatorName: string): string {
  const normalizedName = aggregatorName.toLowerCase().replace(/\s+/g, "-")
  return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/refs/heads/main/aggregator/${normalizedName}.webp`
}

export function getBridgeLogo(bridgeName: string): string {
  const normalizedName = bridgeName.toLowerCase().replace(/\s+/g, "-")
  return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/refs/heads/main/bridge/${normalizedName}.webp`
}

export function filterNumeric(s: string): string {
  // Allow digits and a single dot
  s = s.replace(/[^0-9.]/g, "")
  const parts = s.split(".")
  if (parts.length <= 1) return s
  return parts[0] + "." + parts.slice(1).join("").replace(/\./g, "")
}

export function pickPreferredToken(map: Record<string, any>, native?: string): string | undefined {
  const entries = Object.entries(map)
  if (!entries.length) return undefined
  if (native) {
    const found = entries.find(([, t]) => t.symbol?.toUpperCase() === native.toUpperCase())
    if (found) return found[0]
    const wrapped = entries.find(([, t]) => t.symbol?.toUpperCase() === `W${native.toUpperCase()}`)
    if (wrapped) return wrapped[0]
  }
  return entries[0][0]
}

export function getTokenPrice(chainId: string, tokenAddress: Address, prices?: Record<string, { usd: number }>): number | undefined {
  if (!prices) return undefined
  // For zero address (native), use wrapped native price
  if (tokenAddress.toLowerCase() === zeroAddress.toLowerCase()) {
    const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
    return wrapped ? prices[(wrapped as string).toLowerCase()]?.usd : undefined
  }
  return prices[tokenAddress.toLowerCase()]?.usd
}

export function formatDisplayAmount(val: string): string {
  // Normalize
  if (!val) return "0"
  const [intPartRaw, fracRaw = ""] = val.split(".")
  const intPart = intPartRaw.replace(/^0+/, "") || "0"
  const maxFrac = intPart.length >= 4 ? 2 : 10
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "")
  return frac ? `${intPart}.${frac}` : intPart
}
