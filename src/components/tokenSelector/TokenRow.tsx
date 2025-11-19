import type { CSSProperties } from "react"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { Logo } from "../common/Logo"
import { CurrencyHandler } from "../../sdk/types"

type TokenRowProps = {
  addr: Address
  token: any
  chainId: string
  chains: any
  balances: any
  prices: any
  balancesLoading: boolean
  pricesLoading: boolean
  userAddress?: Address
  onClick: () => void
  style?: CSSProperties // 👈 added
}

export function TokenRow({
  addr,
  token,
  chainId,
  chains,
  balances,
  prices,
  balancesLoading,
  pricesLoading,
  userAddress,
  onClick,
  style,
}: TokenRowProps) {
  const bal = balances?.[chainId]?.[addr.toLowerCase()]
  const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
  const priceAddr = addr.toLowerCase() === zeroAddress.toLowerCase() ? wrapped : addr
  const price = prices?.[chainId]?.[priceAddr?.toLowerCase() || ""]
  const usd = bal && price ? Number(bal.value || 0) * price.usd : undefined
  const showBalanceLoading = balancesLoading && userAddress && !bal
  const showPriceLoading = pricesLoading && !price && !usd
  const balanceText = bal?.value ? Number(bal.value).toFixed(4) : undefined

  return (
    <button
      style={style} // 👈 react-window positioning
      className="w-full py-2 px-2 hover:bg-base-200 rounded flex items-center gap-3"
      onClick={onClick}
    >
      <div className="relative w-6 h-6">
        <Logo src={token.logoURI} alt={token.symbol} fallbackText={token.symbol} />
        {chains?.[chainId]?.data?.icon && (
          <img src={chains[chainId].data.icon} alt="chain" className="w-3 h-3 rounded-full absolute -right-1 -bottom-1 border border-base-100" />
        )}
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium">{token.name}</div>
        <div className="text-xs opacity-70">{token.symbol}</div>
      </div>
      <div className="text-right min-w-24">
        {showBalanceLoading ? (
          <span className="loading loading-spinner loading-xs" />
        ) : balanceText ? (
          <div className="font-mono text-sm opacity-80">{balanceText}</div>
        ) : null}
        {showPriceLoading ? (
          <span className="loading loading-spinner loading-xs ml-2" />
        ) : usd !== undefined && isFinite(usd) ? (
          <div className="text-xs opacity-60">${usd.toFixed(2)}</div>
        ) : null}
      </div>
    </button>
  )
}
