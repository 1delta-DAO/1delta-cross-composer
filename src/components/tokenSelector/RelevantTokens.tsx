import { Address, zeroAddress } from "viem"
import { Logo } from "../common/Logo"

type RelevantTokensBarProps = {
  chainId: string
  chains: any
  relevant: Address[]
  tokensMap: Record<string, any>
  onChange: (addr: Address) => void
}

export function RelevantTokensBar({ chainId, chains, relevant, tokensMap, onChange }: RelevantTokensBarProps) {
  if (!relevant.length) return null

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {relevant.map((addr) => {
        const addrLower = addr.toLowerCase()
        let t = tokensMap[addrLower]
        if (!t && addrLower === zeroAddress) {
          const nativeCurrency = chains?.[chainId]?.data?.nativeCurrency
          if (nativeCurrency) {
            t = {
              symbol: nativeCurrency.symbol,
              name: nativeCurrency.name,
              logoURI: chains?.[chainId]?.data?.icon,
            } as any
          }
        }
        if (!t) return null
        return (
          <button
            key={addr}
            className="btn btn-sm btn-ghost gap-2"
            onClick={() => {
              onChange(addr)
            }}
          >
            <Logo src={t.logoURI} alt={t.symbol} fallbackText={t.symbol} />
            <span>{t.symbol}</span>
          </button>
        )
      })}
    </div>
  )
}
