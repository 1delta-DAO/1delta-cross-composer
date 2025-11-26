import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import { useChainId, useConnection } from 'wagmi'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { useTokenLists } from '../../hooks/useTokenLists'
import { useEvmBalances } from '../../hooks/balances/useEvmBalances'
import { usePriceQuery } from '../../hooks/prices/usePriceQuery'
import { useTokenPrice } from '../../hooks/prices/useTokenPrice'
import { useDebounce } from '../../hooks/useDebounce'
import { CurrencyHandler, SupportedChainId } from '../../sdk/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { getCurrency } from '../../lib/trade-helpers/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useSlippage } from '../../contexts/SlippageContext'
import { useSwapQuotes } from '../../sdk/hooks/useSwapQuotes'
import { usePriceImpact } from '../../hooks/usePriceImpact'
import ExecuteButton from './ExecuteButton'
import { ActionsPanel } from './ActionsPanel'
import { formatDisplayAmount, pickPreferredToken } from './swapUtils'
import type { DestinationCall } from '../../lib/types/destinationAction'
import { reverseQuote } from '../../lib/reverseQuote'
import { getRegisteredActions } from '../actions/shared/actionRegistry'

type Props = {
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}

const DEFAULT_INPUT_CHAIN_ID = SupportedChainId.BASE

export function ActionsTab({ onResetStateChange }: Props) {
  const { address } = useConnection()
  const { data: chains } = useChainsRegistry()
  const { data: lists } = useTokenLists()
  const currentChainId = useChainId()

  const [inputCurrency, setInputCurrency] = useState<RawCurrency | undefined>(undefined)
  const [actionCurrency, setActionCurrency] = useState<RawCurrency | undefined>(undefined)
  const [amount, setAmount] = useState('')
  const [calculatedInputAmount, setCalculatedInputAmount] = useState<string>('')
  const [destinationInfo, setDestinationInfoState] = useState<
    { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string } | undefined
  >(undefined)

  const inputChainId = inputCurrency?.chainId ?? DEFAULT_INPUT_CHAIN_ID
  const actionChainId = actionCurrency?.chainId

  const inputTokensMap = inputChainId ? lists?.[inputChainId] || {} : {}
  const inputAddrs = useMemo(() => (inputChainId ? (Object.keys(inputTokensMap) as Address[]).slice(0, 300) : []), [inputTokensMap, inputChainId])

  useEffect(() => {
    if (inputCurrency || !lists || !chains) return
    const native = chains?.[DEFAULT_INPUT_CHAIN_ID]?.data?.nativeCurrency?.symbol
    const force = DEFAULT_INPUT_CHAIN_ID === SupportedChainId.BASE ? 'USDC' : undefined
    const tokensMap = lists[DEFAULT_INPUT_CHAIN_ID] || {}
    const pick = pickPreferredToken(tokensMap, force || native)
    if (!pick) return
    const meta = tokensMap[pick.toLowerCase()]
    if (!meta) return
    setInputCurrency({
      chainId: DEFAULT_INPUT_CHAIN_ID,
      address: pick,
      decimals: meta.decimals ?? 18,
      symbol: meta.symbol,
    })
  }, [inputCurrency, lists, chains])

  const inputAddressesWithNative = useMemo(() => {
    if (!inputChainId || !address) return []
    const addrs = [...inputAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [inputAddrs, inputChainId, address])

  const { data: inputBalances } = useEvmBalances({
    chainId: inputChainId,
    userAddress: address,
    tokenAddresses: inputAddressesWithNative,
  })

  const inputPriceCurrencies = useMemo(() => {
    if (!inputBalances?.[inputChainId] || !address || !inputChainId) return []

    const currencies: RawCurrency[] = []
    const seenAddresses = new Set<string>()

    for (const addr of inputAddressesWithNative) {
      const bal = inputBalances[inputChainId][addr.toLowerCase()]
      if (bal && Number(bal.value || 0) > 0) {
        const currency = getCurrency(inputChainId, addr)
        if (currency) {
          const key = currency.address.toLowerCase()
          if (!seenAddresses.has(key)) {
            seenAddresses.add(key)
            currencies.push(currency)
          }
        }
      }
    }

    return currencies
  }, [inputBalances, inputChainId, inputAddressesWithNative, address])

  const { data: inputPrices } = usePriceQuery({
    currencies: inputPriceCurrencies,
    enabled: inputPriceCurrencies.length > 0,
  })

  const inputTokenPriceAddr = useMemo(() => {
    if (!inputCurrency) return undefined
    if (inputCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(inputCurrency.chainId, zeroAddress) as Address | undefined
    }
    return inputCurrency.address as Address
  }, [inputCurrency])

  const inputTokenPriceInCache = inputTokenPriceAddr && inputPrices?.[inputCurrency?.chainId || inputChainId]?.[inputTokenPriceAddr.toLowerCase()]

  const { price: inputTokenPrice, isLoading: isLoadingInputPrice } = useTokenPrice({
    chainId: inputCurrency?.chainId || inputChainId,
    tokenAddress: inputTokenPriceAddr,
    enabled: Boolean(inputCurrency && !inputTokenPriceInCache),
  })

  const inputPrice = useMemo(() => {
    if (inputTokenPrice !== undefined) return inputTokenPrice
    if (inputTokenPriceAddr && inputPrices?.[inputCurrency?.chainId || inputChainId]?.[inputTokenPriceAddr.toLowerCase()]?.usd) {
      return inputPrices[inputCurrency?.chainId || inputChainId][inputTokenPriceAddr.toLowerCase()].usd
    }
    return undefined
  }, [inputTokenPrice, inputTokenPriceAddr, inputPrices, inputCurrency, inputChainId])

  const actionTokenPriceAddr = useMemo(() => {
    if (!actionCurrency) return undefined
    if (actionCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(actionCurrency.chainId, zeroAddress) as Address | undefined
    }
    return actionCurrency.address as Address
  }, [actionCurrency])

  const { price: actionTokenPrice, isLoading: isLoadingActionPrice } = useTokenPrice({
    chainId: actionCurrency?.chainId || actionChainId || '',
    tokenAddress: actionTokenPriceAddr,
    enabled: Boolean(actionCurrency),
  })

  const debouncedAmount = useDebounce(amount, 1000)
  const inputKey = useMemo(
    () => `${inputCurrency?.chainId || inputChainId}|${(inputCurrency?.address || '').toLowerCase()}`,
    [inputCurrency, inputChainId],
  )
  const actionKey = useMemo(
    () => `${actionCurrency?.chainId || actionChainId}|${(actionCurrency?.address || '').toLowerCase()}`,
    [actionCurrency, actionChainId],
  )
  const debouncedInputKey = useDebounce(inputKey, 1000)
  const debouncedActionKey = useDebounce(actionKey, 1000)

  const { slippage, setPriceImpact } = useSlippage()
  const [txInProgress, setTxInProgress] = useState(false)
  const [destinationCalls, setDestinationCalls] = useState<DestinationCall[]>([])
  const [actionResetKey, setActionResetKey] = useState(0)
  const lastCalculatedPricesRef = useRef<{ priceIn: number; priceOut: number } | null>(null)

  const isSwapOrBridge = useMemo(() => {
    return Boolean(inputCurrency && actionCurrency)
  }, [inputCurrency, actionCurrency])

  const enableRequoting = useMemo(() => {
    if (!destinationInfo?.actionId) return false
    const actionDef = getRegisteredActions().find((a) => a.id === destinationInfo.actionId)
    return actionDef?.requiresExactDestinationAmount ?? false
  }, [destinationInfo?.actionId])

  const {
    quotes,
    quoting,
    selectedQuoteIndex,
    setSelectedQuoteIndex,
    amountWei,
    refreshQuotes,
    abortQuotes,
    highSlippageLossWarning,
    currentBuffer,
  } = useSwapQuotes({
    srcCurrency: inputCurrency,
    dstCurrency: actionCurrency,
    debouncedAmount,
    debouncedSrcKey: debouncedInputKey,
    debouncedDstKey: debouncedActionKey,
    slippage,
    txInProgress,
    destinationCalls,
    minRequiredAmount: destinationInfo?.currencyAmount,
    enableRequoting,
  })

  const selectedTrade = quotes[selectedQuoteIndex]?.trade
  const [preservedTrade, setPreservedTrade] = useState<typeof selectedTrade | undefined>(undefined)
  const tradeToUse = preservedTrade || selectedTrade

  const quoteOut = useMemo(() => {
    if (!isSwapOrBridge || !selectedTrade?.outputAmount) return undefined
    try {
      const exact = CurrencyHandler.toExact(selectedTrade.outputAmount)
      return formatDisplayAmount(exact)
    } catch {
      return undefined
    }
  }, [selectedTrade, isSwapOrBridge])

  const priceImpact = usePriceImpact({
    selectedTrade,
    amount,
    quoteOut,
    srcToken: inputCurrency?.address as any,
    dstToken: actionCurrency?.address as any,
    srcChainId: inputChainId,
    dstChainId: actionChainId,
  })

  useEffect(() => {
    if (isSwapOrBridge) {
      setPriceImpact(priceImpact)
    }
  }, [priceImpact, setPriceImpact, isSwapOrBridge])

  const queryClient = useQueryClient()

  const setDestinationInfo = useCallback(
    (
      currencyAmount: RawCurrencyAmount | undefined,
      receiverAddress: string | undefined,
      destinationCalls: DestinationCall[],
      actionLabel?: string,
      actionId?: string,
    ) => {
      if (!currencyAmount) {
        setDestinationInfoState(undefined)
        setCalculatedInputAmount('')
        setDestinationCalls([])
        setActionCurrency(undefined)
        return
      }

      const actionCur = currencyAmount.currency as RawCurrency
      setActionCurrency(actionCur)

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        setDestinationInfoState(undefined)
        setCalculatedInputAmount('')
        setDestinationCalls([])
        setActionCurrency(undefined)
        return
      }

      const priceIn = inputPrice ?? 0
      const priceOut = actionTokenPrice ?? 0

      if (priceIn <= 0 || priceOut <= 0) {
        setDestinationInfoState({ currencyAmount, actionLabel, actionId })
        setDestinationCalls(destinationCalls)
        setCalculatedInputAmount('')
        return
      }

      const decimalsOut = actionCur.decimals
      const amountIn = reverseQuote(decimalsOut, currencyAmount.amount.toString(), priceIn, priceOut, slippage)

      setCalculatedInputAmount(amountIn)
      setDestinationInfoState({ currencyAmount, actionLabel, actionId })
      setDestinationCalls(destinationCalls)

      setAmount(amountIn)
    },
    [inputCurrency, inputPrice, actionTokenPrice, slippage],
  )

  useEffect(() => {
    if (!destinationInfo?.currencyAmount) {
      lastCalculatedPricesRef.current = null
      return
    }

    if (isLoadingInputPrice || isLoadingActionPrice) return

    const priceIn = inputPrice ?? 0
    const priceOut = actionTokenPrice ?? 0

    if (priceIn > 0 && priceOut > 0) {
      const lastPrices = lastCalculatedPricesRef.current
      const pricesChanged = !lastPrices || lastPrices.priceIn !== priceIn || lastPrices.priceOut !== priceOut

      if (pricesChanged || !calculatedInputAmount) {
        const actionCur = destinationInfo.currencyAmount.currency as RawCurrency
        const decimalsOut = actionCur.decimals
        try {
          const amountIn = reverseQuote(decimalsOut, destinationInfo.currencyAmount.amount.toString(), priceIn, priceOut, slippage)
          setCalculatedInputAmount(amountIn)
          setAmount(amountIn)
          lastCalculatedPricesRef.current = { priceIn, priceOut }
        } catch (error) {
          console.error('Error recalculating reverse quote:', error)
        }
      }
    } else {
      lastCalculatedPricesRef.current = null
    }
  }, [destinationInfo, inputPrice, actionTokenPrice, isLoadingInputPrice, isLoadingActionPrice, calculatedInputAmount, slippage])

  return (
    <div>
      <ActionsPanel
        resetKey={actionResetKey}
        srcCurrency={inputCurrency}
        dstCurrency={actionCurrency}
        currentChainId={currentChainId}
        tokenLists={lists}
        setDestinationInfo={setDestinationInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={setSelectedQuoteIndex}
        slippage={slippage}
        onSrcCurrencyChange={setInputCurrency}
        calculatedInputAmount={calculatedInputAmount}
        destinationInfo={destinationInfo}
        isRequoting={quoting && enableRequoting}
      />

      {(tradeToUse || (destinationInfo && inputCurrency && actionCurrency)) && (
        <div className="mt-4 space-y-3">
          {highSlippageLossWarning && tradeToUse && (
            <div className="rounded-lg bg-warning/10 border border-warning p-3">
              <div className="flex items-start gap-2">
                <span className="text-warning text-lg">⚠️</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-warning">High Slippage Loss Warning</div>
                  <div className="text-xs text-warning/80 mt-1">
                    This trade has high slippage loss. Consider increasing your slippage tolerance to ensure the transaction succeeds.
                  </div>
                  {currentBuffer > 0.003 && <div className="text-xs text-warning/70 mt-1">Current buffer: {(currentBuffer * 100).toFixed(2)}%</div>}
                </div>
              </div>
            </div>
          )}
          <ExecuteButton
            trade={tradeToUse}
            srcCurrency={inputCurrency}
            dstCurrency={actionCurrency}
            amountWei={amountWei}
            destinationCalls={destinationCalls}
            chains={chains}
            quoting={quoting && !tradeToUse}
            onDone={(hashes) => {
              if (inputCurrency?.chainId && address) {
                queryClient.invalidateQueries({
                  queryKey: ['balances', inputCurrency.chainId, address],
                })
                queryClient.invalidateQueries({
                  queryKey: ['tokenBalance', inputCurrency.chainId, address],
                })
              }
              if (actionCurrency?.chainId && address) {
                queryClient.invalidateQueries({
                  queryKey: ['balances', actionCurrency.chainId, address],
                })
                queryClient.invalidateQueries({
                  queryKey: ['tokenBalance', actionCurrency.chainId, address],
                })
              }
              setDestinationInfo(undefined, undefined, [])

              if (hashes.src) {
                setActionResetKey((prev) => prev + 1)
                setPreservedTrade(undefined)
              }
            }}
            onTransactionStart={() => {
              if (selectedTrade) {
                setPreservedTrade(selectedTrade)
              }
              setTxInProgress(true)
            }}
            onTransactionEnd={() => {
              setTxInProgress(false)
            }}
            onReset={() => {
              setAmount('')
              setTxInProgress(false)
              setPreservedTrade(undefined)
            }}
            onResetStateChange={onResetStateChange}
          />
        </div>
      )}
    </div>
  )
}
