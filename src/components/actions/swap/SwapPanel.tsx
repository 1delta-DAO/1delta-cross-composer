import { useState, useMemo, useEffect } from 'react'
import type { RawCurrency } from '../../../types/currency'
import { CurrencyHandler } from '../../../sdk/types'
import { ActionHandler } from '../shared/types'
import { TokenSelectorModal } from '../../modals/TokenSelectorModal'
import { parseUnits } from 'viem'
import type { Address } from 'viem'
import { Logo } from '../../common/Logo'
import { getTokenFromCache } from '../../../lib/data/tokenListsCache'

interface SwapPanelProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  setDestinationInfo?: ActionHandler
  resetKey?: number
}

export function SwapPanel({
  srcCurrency,
  dstCurrency: initialDstCurrency,
  setDestinationInfo,
  resetKey,
}: SwapPanelProps) {
  const [selectedDstCurrency, setSelectedDstCurrency] = useState<RawCurrency | undefined>(
    initialDstCurrency
  )
  const [outputAmount, setOutputAmount] = useState('')
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [tokenModalQuery, setTokenModalQuery] = useState('')

  const dstCurrency = selectedDstCurrency || initialDstCurrency

  const dstTokenInfo = useMemo(() => {
    if (!dstCurrency?.chainId || !dstCurrency?.address) return undefined
    return getTokenFromCache(String(dstCurrency.chainId), dstCurrency.address)
  }, [dstCurrency?.chainId, dstCurrency?.address])

  useEffect(() => {
    if (!srcCurrency?.chainId) return

    const currentDstChainId = dstCurrency?.chainId
    if (currentDstChainId && currentDstChainId !== srcCurrency.chainId) {
      if (selectedDstCurrency && selectedDstCurrency.chainId !== srcCurrency.chainId) {
        setSelectedDstCurrency(undefined)
      }
      setOutputAmount('')
      setDestinationInfo?.(undefined, undefined, [])
    }
  }, [srcCurrency?.chainId, dstCurrency?.chainId, selectedDstCurrency, setDestinationInfo])

  useEffect(() => {
    if (!srcCurrency || !dstCurrency || !setDestinationInfo || !outputAmount) {
      setDestinationInfo?.(undefined, undefined, [])
      return
    }

    const amount = Number(outputAmount)
    if (!amount || amount <= 0) {
      setDestinationInfo?.(undefined, undefined, [])
      return
    }

    const tokenMeta =
      dstCurrency.chainId && dstCurrency.address
        ? getTokenFromCache(String(dstCurrency.chainId), dstCurrency.address)
        : undefined

    const currency = tokenMeta || dstCurrency
    if (!currency) {
      setDestinationInfo?.(undefined, undefined, [])
      return
    }

    try {
      const outputAmountWei = parseUnits(outputAmount, currency.decimals)
      const currencyAmount = CurrencyHandler.fromRawAmount(currency, outputAmountWei.toString())
      setDestinationInfo(currencyAmount, undefined, [])
    } catch {
      setDestinationInfo?.(undefined, undefined, [])
    }
  }, [srcCurrency, dstCurrency, outputAmount, setDestinationInfo])

  const handleOutputAmountChange = (value: string) => {
    setOutputAmount(value)
  }

  const handleTokenSelect = (currency: RawCurrency | undefined, close: boolean = true) => {
    if (currency) {
      setSelectedDstCurrency(currency)
      setOutputAmount('')
    }
    setTokenModalOpen(!close)
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
            className="btn btn-outline flex items-center gap-2"
            onClick={() => setTokenModalOpen(true)}
            disabled={!srcCurrency}
          >
            {dstCurrency ? (
              <>
                <Logo
                  src={dstTokenInfo?.logoURI}
                  alt={dstCurrency.symbol || 'Token'}
                  size={16}
                  fallbackText={dstCurrency.symbol?.[0] || 'T'}
                />
                <span>{dstCurrency.symbol || 'Select token'}</span>
              </>
            ) : (
              <span>Select token</span>
            )}
          </button>
        </div>
      </div>

      <TokenSelectorModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        currency={dstCurrency}
        onCurrencyChange={handleTokenSelect}
        query={tokenModalQuery}
        onQueryChange={setTokenModalQuery}
        showChainSelector={false}
        initialChainId={srcCurrency.chainId}
        excludeAddresses={srcCurrency.address ? [srcCurrency.address as Address] : undefined}
      />
    </div>
  )
}
