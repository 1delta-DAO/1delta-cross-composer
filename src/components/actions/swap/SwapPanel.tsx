import { useState, useMemo, useEffect, useRef } from 'react'
import type { RawCurrency } from '../../../types/currency'
import { CurrencyHandler } from '../../../sdk/types'
import { DestinationActionHandler } from '../shared/types'
import { SwapCard } from './SwapCard'
import { TokenSelectorModal } from '../../modals/TokenSelectorModal'
import { parseUnits } from 'viem'
import type { Address } from 'viem'
import { fetchAllAggregatorTrades } from '../../../lib/trade-helpers/aggregatorSelector'
import { TradeType } from '@1delta/lib-utils'
import { DUMMY_ADDRESS } from '../../../lib/consts'
import { Logo } from '../../common/Logo'
import { useConnection } from 'wagmi'

type TokenListsMeta = Record<string, Record<string, RawCurrency>>

interface SwapPanelProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  tokenLists?: TokenListsMeta
  setDestinationInfo?: DestinationActionHandler
  slippage?: number
  resetKey?: number
}

export function SwapPanel({
  srcCurrency,
  dstCurrency: initialDstCurrency,
  tokenLists,
  setDestinationInfo,
  slippage = 0.5,
  resetKey,
}: SwapPanelProps) {
  const { address } = useConnection()
  const receiverAddress = address || DUMMY_ADDRESS

  const [selectedDstCurrency, setSelectedDstCurrency] = useState<RawCurrency | undefined>(
    initialDstCurrency
  )
  const [outputAmount, setOutputAmount] = useState('')
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [tokenModalQuery, setTokenModalQuery] = useState('')
  const [selectedAggregator, setSelectedAggregator] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<Array<{ label: string; trade: any }>>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const loadingRef = useRef(false)

  const dstCurrency = selectedDstCurrency || initialDstCurrency

  const dstTokenInfo = useMemo(() => {
    if (!dstCurrency?.chainId || !dstCurrency?.address || !tokenLists) return undefined
    return tokenLists[dstCurrency.chainId]?.[dstCurrency.address.toLowerCase()]
  }, [dstCurrency?.chainId, dstCurrency?.address, tokenLists])

  useEffect(() => {
    if (!srcCurrency?.chainId) return

    const currentDstChainId = dstCurrency?.chainId
    if (currentDstChainId && currentDstChainId !== srcCurrency.chainId) {
      if (selectedDstCurrency && selectedDstCurrency.chainId !== srcCurrency.chainId) {
        setSelectedDstCurrency(undefined)
      }
      setOutputAmount('')
      setSelectedAggregator(null)
      setQuotes([])
      setDestinationInfo?.(undefined, undefined, [])
    }
  }, [srcCurrency?.chainId, dstCurrency?.chainId, selectedDstCurrency, setDestinationInfo])

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!srcCurrency || !dstCurrency || !outputAmount) {
        setQuotes([])
        return
      }

      const amount = Number(outputAmount)
      if (!amount || amount <= 0) {
        setQuotes([])
        setSelectedAggregator(null)
        return
      }

      if (loadingRef.current) return

      loadingRef.current = true
      setLoadingQuotes(true)
      try {
        const amountInWei = parseUnits(outputAmount, dstCurrency.decimals)
        const fromCurrency = srcCurrency
        const toCurrency = dstCurrency

        const trades = await fetchAllAggregatorTrades(srcCurrency.chainId, {
          chainId: srcCurrency.chainId,
          fromCurrency,
          toCurrency,
          swapAmount: amountInWei,
          slippage,
          caller: receiverAddress,
          receiver: receiverAddress,
          tradeType: TradeType.EXACT_OUTPUT,
          flashSwap: false,
          usePermit: true,
        } as any)

        setQuotes(trades.map((t) => ({ label: t.aggregator.toString(), trade: t.trade })))
      } catch (error) {
        console.error('Error fetching swap quotes:', error)
        setQuotes([])
      } finally {
        setLoadingQuotes(false)
        loadingRef.current = false
      }
    }

    fetchQuotes()
  }, [
    srcCurrency?.chainId,
    srcCurrency?.address,
    dstCurrency?.chainId,
    dstCurrency?.address,
    outputAmount,
    address,
    slippage,
  ])

  const handleOutputAmountChange = (value: string) => {
    setOutputAmount(value)
    setSelectedAggregator(null)
  }

  const handleTokenSelect = (currency: RawCurrency | undefined, close: boolean = true) => {
    if (currency) {
      setSelectedDstCurrency(currency)
      setOutputAmount('')
      setSelectedAggregator(null)
      setQuotes([])
    }
    setTokenModalOpen(!close)
  }

  const handleQuoteSelect = async (aggregator: string, trade: any) => {
    if (!srcCurrency || !dstCurrency || !setDestinationInfo) return

    setSelectedAggregator(aggregator)

    const dstTokenMeta = tokenLists?.[dstCurrency.chainId]?.[dstCurrency.address.toLowerCase()]

    if (dstTokenMeta) {
      const outputAmountWei = parseUnits(outputAmount, dstCurrency.decimals)
      const currencyAmount = CurrencyHandler.fromRawAmount(dstTokenMeta, outputAmountWei.toString())

      setDestinationInfo(currencyAmount, undefined, [])
    }
  }

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setOutputAmount('')
      setSelectedDstCurrency(initialDstCurrency)
      setSelectedAggregator(null)
      setQuotes([])
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

        {loadingQuotes && (
          <div className="text-xs opacity-70 text-center py-2">Fetching quotes...</div>
        )}

        {quotes.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {quotes.map((quote, index) => (
              <SwapCard
                key={`${quote.label}-${index}`}
                aggregator={quote.label}
                trade={quote.trade}
                outputTokenSymbol={dstCurrency?.symbol || 'tokens'}
                isSelected={selectedAggregator === quote.label}
                onSelect={() => handleQuoteSelect(quote.label, quote.trade)}
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
        query={tokenModalQuery}
        onQueryChange={setTokenModalQuery}
        showChainSelector={false}
        initialChainId={srcCurrency.chainId}
        excludeAddresses={srcCurrency.address ? [srcCurrency.address as Address] : undefined}
      />
    </div>
  )
}
