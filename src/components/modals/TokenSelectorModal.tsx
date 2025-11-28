import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import { ChainSelector } from '../swap/ChainSelector'
import { TokenSelector } from '../tokenSelector'
import type { RawCurrency } from '../../types/currency'
import { getCurrency } from '../../lib/trade-helpers/utils'
import { Chain } from '@1delta/chain-registry'
import { useConnection } from 'wagmi'

type Props = {
  open: boolean
  onClose: () => void
  currency?: RawCurrency
  onCurrencyChange: (currency: RawCurrency) => void
  onChainChange?: (chainId: string) => void
  query: string
  onQueryChange: (query: string) => void
  excludeAddresses?: Address[]
  showChainSelector?: boolean
  initialChainId?: string
}

export function TokenSelectorModal({
  open,
  onClose,
  currency,
  onCurrencyChange,
  onChainChange,
  query,
  onQueryChange,
  excludeAddresses,
  showChainSelector = true,
  initialChainId,
}: Props) {
  const [chainId, setChainId] = useState<string | undefined>(
    initialChainId ?? currency?.chainId ?? Chain.POLYGON_MAINNET
  )

  useEffect(() => {
    if (open) {
      if (initialChainId) {
        setChainId(initialChainId)
      } else if (currency?.chainId) {
        setChainId(currency.chainId)
      }
    }
  }, [open, initialChainId, currency?.chainId])

  const tokenValue = useMemo(() => currency?.address as Address | undefined, [currency?.address])

  const handleTokenSelect = useCallback(
    (addr: Address) => {
      if (!chainId) return
      const selectedCurrency = getCurrency(chainId, addr)
      if (selectedCurrency) {
        onCurrencyChange(selectedCurrency)
      }
      onClose()
    },
    [chainId, onCurrencyChange, onClose]
  )

  const handleChainChange = useCallback(
    (cid: string) => {
      setChainId(cid)
      onChainChange?.(cid)
    },
    [onChainChange]
  )

  if (!open) return null

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box max-w-2xl max-h-[90dvh] p-0 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
          <h3 className="font-bold">Select a token</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* search + chain selector */}
        <div className="px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <input
              className="input input-bordered flex-1"
              placeholder="Search tokens"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            {showChainSelector && (
              <div className="min-w-40">
                <ChainSelector value={chainId} onChange={handleChainChange} />
              </div>
            )}
          </div>
        </div>

        {/* token list (scrollable area) */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto">
          {chainId && (
            <div className="h-full">
              <TokenSelector
                chainId={chainId}
                value={tokenValue}
                onChange={handleTokenSelect}
                excludeAddresses={excludeAddresses}
                query={query}
                onQueryChange={onQueryChange}
                showSearch={false}
                listMode={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
