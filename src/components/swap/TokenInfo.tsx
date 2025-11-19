import type { Address } from "viem"
import { zeroAddress } from "viem"
import { buildTokenUrl } from "../../lib/explorer"

export function ExplorerLink({ chains, chainId, tokenAddress }: { chains?: any; chainId: string; tokenAddress: Address }) {
  const href = chains ? buildTokenUrl(chains, chainId, tokenAddress) : undefined
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" className="link link-primary mt-1 inline-block">
      View on explorer
    </a>
  )
}

export function SelectedTokenInfo({
  chains,
  chainId,
  tokenAddress,
  balance,
  price,
  balanceLoading,
  priceLoading,
}: {
  chains?: any
  chainId: string
  tokenAddress: Address
  balance?: string
  price?: number
  balanceLoading?: boolean
  priceLoading?: boolean
}) {
  const isNative = tokenAddress.toLowerCase() === zeroAddress.toLowerCase()
  const href = !isNative && chains ? buildTokenUrl(chains, chainId, tokenAddress) : undefined
  const usd = balance && price ? Number(balance) * price : undefined
  return (
    <div className="text-xs mt-1 flex items-center justify-between">
      <div className="opacity-70 flex items-center gap-2">
        Balance: {balanceLoading ? <span className="loading loading-spinner loading-xs" /> : (balance ?? "-")}
      </div>
      <div className="flex items-center gap-3">
        {priceLoading ? (
          <span className="loading loading-spinner loading-xs" />
        ) : usd !== undefined && isFinite(usd) ? (
          <span>${usd.toFixed(2)}</span>
        ) : null}
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="link link-primary">
            Explorer
          </a>
        )}
      </div>
    </div>
  )
}
