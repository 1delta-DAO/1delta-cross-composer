import { useState, useMemo, useEffect, useCallback } from 'react'
import type { RawCurrency } from '../../../types/currency'
import { CurrencyHandler } from '../../../sdk/types'
import { ActionHandler } from '../shared/types'
import { BridgeCard } from './BridgeCard'
import { TokenSelectorModal } from '../../modals/TokenSelectorModal'
import { parseUnits, zeroAddress } from 'viem'
import type { Address } from 'viem'
import { useDebounce } from '../../../hooks/useDebounce'
import type { GenericTrade } from '@1delta/lib-utils'
import { getTokenFromCache } from '../../../lib/data/tokenListsCache'

interface BridgePanelProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  setDestinationInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  resetKey?: number
}

export function BridgePanel({
  srcCurrency,
  dstCurrency: initialDstCurrency,
  setDestinationInfo,
  quotes,
  selectedQuoteIndex = 0,
  setSelectedQuoteIndex,
  slippage = 0.5,
  resetKey,
}: BridgePanelProps) {
  const [selectedDstCurrency, setSelectedDstCurrency] = useState<RawCurrency | undefined>(
    initialDstCurrency
  )
  const [outputAmount, setOutputAmount] = useState('')
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [tokenModalQuery, setTokenModalQuery] = useState('')

  const dstCurrency = useMemo(
    () => selectedDstCurrency || initialDstCurrency,
    [selectedDstCurrency, initialDstCurrency]
  )
  const debouncedOutputAmount = useDebounce(outputAmount, 1000)

  useEffect(() => {
    if (!srcCurrency || !dstCurrency || !setDestinationInfo || !debouncedOutputAmount) {
      setDestinationInfo?.(undefined, undefined, [])
      return
    }

    const amount = Number(debouncedOutputAmount)
    if (!amount || amount <= 0) {
      setDestinationInfo?.(undefined, undefined, [])
      return
    }

    if (!dstCurrency.chainId || !dstCurrency.address) {
      return
    }

    const dstTokenMeta = getTokenFromCache(String(dstCurrency.chainId), dstCurrency.address)
    if (!dstTokenMeta) {
      return
    }

    const outputAmountWei = parseUnits(debouncedOutputAmount, dstCurrency.decimals)
    const currencyAmount = CurrencyHandler.fromRawAmount(dstTokenMeta, outputAmountWei.toString())

    setDestinationInfo(currencyAmount, undefined, [])
  }, [srcCurrency, dstCurrency, debouncedOutputAmount, setDestinationInfo])

  const handleOutputAmountChange = (value: string) => {
    setOutputAmount(value)
  }

  const handleTokenSelect = useCallback((currency: RawCurrency) => {
    setSelectedDstCurrency(currency)
    setOutputAmount('')
    setTokenModalOpen(false)
  }, [])

  const handleChainChange = useCallback((chainId: string) => {
    setSelectedDstCurrency({ chainId, address: zeroAddress, decimals: 18 })
    setOutputAmount('')
  }, [])

  const handleQuoteSelect = (index: number) => {
    if (!srcCurrency || !dstCurrency || !setDestinationInfo || !quotes || !setSelectedQuoteIndex)
      return

    setSelectedQuoteIndex(index)

    if (!dstCurrency.chainId || !dstCurrency.address) {
      return
    }

    const dstTokenMeta = getTokenFromCache(String(dstCurrency.chainId), dstCurrency.address)

    if (dstTokenMeta && outputAmount) {
      const outputAmountWei = parseUnits(outputAmount, dstCurrency.decimals)
      const currencyAmount = CurrencyHandler.fromRawAmount(dstTokenMeta, outputAmountWei.toString())

      setDestinationInfo(currencyAmount, undefined, [])
    }
  }

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setOutputAmount('')
      setSelectedDstCurrency(initialDstCurrency)
      setDestinationInfo?.(undefined, undefined, [])
    }
  }, [resetKey])

  if (!srcCurrency) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Output amount"
            value={outputAmount}
            onChange={(e) => handleOutputAmountChange(e.target.value)}
            inputMode="decimal"
          />
          <button
            className="btn btn-outline"
            onClick={() => setTokenModalOpen(true)}
            disabled={!srcCurrency}
          >
            {dstCurrency ? (
              <span>{dstCurrency.symbol || 'Select token'}</span>
            ) : (
              <span>Select token</span>
            )}
          </button>
        </div>

        {quotes && quotes.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {quotes.map((quote, index) => (
              <BridgeCard
                key={`${quote.label}-${index}`}
                bridge={quote.label}
                trade={quote.trade}
                outputTokenSymbol={dstCurrency?.symbol || 'tokens'}
                isSelected={selectedQuoteIndex === index}
                onSelect={() => handleQuoteSelect(index)}
              />
            ))}
          </div>
        )}
      </div>

      <TokenSelectorModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        currency={dstCurrency}
        onCurrencyChange={handleTokenSelect}
        onChainChange={handleChainChange}
        query={tokenModalQuery}
        onQueryChange={setTokenModalQuery}
        showChainSelector={true}
        excludeAddresses={
          srcCurrency && dstCurrency && srcCurrency.chainId === dstCurrency.chainId
            ? [srcCurrency.address as Address]
            : undefined
        }
      />
    </div>
  )
}
