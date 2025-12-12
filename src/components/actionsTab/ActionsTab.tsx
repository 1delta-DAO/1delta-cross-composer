import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Address } from 'viem'
import { zeroAddress, parseUnits } from 'viem'
import { useChainId, useConnection } from 'wagmi'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { useTokenLists } from '../../hooks/useTokenLists'
import { useBalanceQuery } from '../../hooks/balances/useBalanceQuery'
import { usePriceQuery } from '../../hooks/prices/usePriceQuery'
import { useDebounce } from '../../hooks/useDebounce'
import { CurrencyHandler, SupportedChainId } from '../../sdk/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { getCurrency } from '../../lib/trade-helpers/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useSlippage } from '../../contexts/SlippageContext'
import { useTradeQuotes } from '../../sdk/hooks/useTradeQuotes'
import { useQuoteValidation } from '../../sdk/hooks/useQuoteValidation'
import type { Quote } from '../../sdk/hooks/useQuoteFetcher'
import ExecuteButton from './ExecuteButton'
import { ActionsPanel } from './ActionsPanel'
import { formatDisplayAmount, pickPreferredToken } from './swapUtils'
import type { ActionCall, ActionHandler } from '../actions/shared/types'
import {
  generateDestinationCallsKey,
  generateCurrencyKey,
} from '../../sdk/hooks/useTradeQuotes/stateHelpers'
import { detectChainTransition } from '../../sdk/hooks/useTradeQuotes/inputValidation'
import { useDestinationReverseQuote } from '../../sdk/hooks/useDestinationReverseQuote'
import { useQuoteTrace } from '../../contexts/QuoteTraceContext'
import { useDestinationInfo } from '../../contexts/DestinationInfoContext'

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

  /** This sets the destination purchase info */
  const { destinationInfo, setDestinationInfoState } = useDestinationInfo()

  const inputChainId = inputCurrency?.chainId ?? DEFAULT_INPUT_CHAIN_ID
  const actionChainId = actionCurrency?.chainId

  const inputTokensMap = inputChainId ? lists?.[inputChainId] || {} : {}
  const inputAddrs = useMemo(
    () => (inputChainId ? (Object.keys(inputTokensMap) as Address[]).slice(0, 300) : []),
    [inputTokensMap, inputChainId]
  )

  useEffect(() => {
    if (inputCurrency || !lists || !chains) return
    const native = chains?.[DEFAULT_INPUT_CHAIN_ID]?.data?.nativeCurrency?.symbol
    const force = DEFAULT_INPUT_CHAIN_ID === SupportedChainId.BASE ? 'USDC' : undefined
    const tokensMap = lists[DEFAULT_INPUT_CHAIN_ID] || {}
    const pick = pickPreferredToken(tokensMap, force || native)
    if (!pick) return
    const meta = tokensMap[pick.toLowerCase()]
    if (!meta) return
    setInputCurrency(meta)
  }, [inputCurrency, lists, chains])

  const inputAddressesWithNative = useMemo(() => {
    if (!inputChainId || !address) return []
    const addrs = [...inputAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [inputAddrs, inputChainId, address])

  const inputBalanceCurrencies = useMemo(() => {
    if (!inputChainId || !address) return []
    const currencies: RawCurrency[] = []
    const seenAddresses = new Set<string>()

    for (const addr of inputAddressesWithNative) {
      const currency = getCurrency(inputChainId, addr)
      if (currency) {
        const key = currency.address.toLowerCase()
        if (!seenAddresses.has(key)) {
          seenAddresses.add(key)
          currencies.push(currency)
        }
      }
    }

    return currencies
  }, [inputAddressesWithNative, inputChainId, address])

  const { data: inputBalances } = useBalanceQuery({
    currencies: inputBalanceCurrencies,
    enabled: inputBalanceCurrencies.length > 0 && Boolean(address),
  })

  const inputPriceCurrencies = useMemo(() => {
    if (!inputBalances?.[inputChainId] || !address || !inputChainId) return []

    const currencies: RawCurrency[] = []
    const seenAddresses = new Set<string>()

    for (const addr of inputAddressesWithNative) {
      const bal = inputBalances[inputChainId]?.[addr.toLowerCase()]
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

  const allCurrenciesForPrice = useMemo(() => {
    const currencies: RawCurrency[] = []
    const seenKeys = new Set<string>()

    const addCurrency = (currency?: RawCurrency) => {
      if (!currency) return
      const key = `${currency.chainId}-${currency.address.toLowerCase()}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        currencies.push(currency)
      }
    }

    addCurrency(inputCurrency)
    addCurrency(actionCurrency)

    if (inputPriceCurrencies.length > 0) {
      for (const currency of inputPriceCurrencies) {
        addCurrency(currency)
      }
    }

    return currencies
  }, [inputCurrency, actionCurrency, inputPriceCurrencies])

  const {
    data: pricesData,
    isLoading: isLoadingPrices,
    isFetching: isFetchingPrices,
  } = usePriceQuery({
    currencies: allCurrenciesForPrice,
    enabled: allCurrenciesForPrice.length > 0,
  })

  const inputPrice = useMemo(() => {
    if (!inputCurrency || !pricesData) return undefined
    const chainId = inputCurrency.chainId || inputChainId
    const priceKey = inputCurrency.address.toLowerCase()
    return pricesData[chainId]?.[priceKey]?.usd
  }, [inputCurrency, pricesData, inputChainId])

  const actionTokenPrice = useMemo(() => {
    if (!actionCurrency || !pricesData) return undefined
    const chainId = actionCurrency.chainId || actionChainId
    const priceKey = actionCurrency.address.toLowerCase()
    return pricesData[chainId!]?.[priceKey]?.usd
  }, [actionCurrency, pricesData, actionChainId])

  const debouncedAmount = useDebounce(amount, 1000)

  const { slippage, setPriceImpact } = useSlippage()
  const [txInProgress, setTxInProgress] = useState(false)
  const [destinationCalls, setDestinationCalls] = useState<ActionCall[]>([])
  const [actionResetKey, setActionResetKey] = useState(0)

  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const isUserSelectionRef = useRef<boolean>(false)

  const prevSrcKeyRef = useRef<string>('')
  const prevDstKeyRef = useRef<string>('')
  const prevIsSameChainRef = useRef<boolean | null>(null)
  const prevDestinationCallsKeyRef = useRef<string>('')
  const prevTxInProgressRef = useRef(txInProgress)

  const isSwapOrBridge = useMemo(() => {
    return Boolean(inputCurrency && actionCurrency)
  }, [inputCurrency, actionCurrency])

  const srcAmount = useMemo<RawCurrencyAmount | undefined>(() => {
    if (!inputCurrency || !debouncedAmount) return undefined
    const amountNum = Number(debouncedAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) return undefined
    try {
      const amountWei = parseUnits(debouncedAmount, inputCurrency.decimals)
      return CurrencyHandler.fromRawAmount(inputCurrency, amountWei.toString())
    } catch {
      return undefined
    }
  }, [inputCurrency, debouncedAmount])

  const srcKey = useMemo(() => generateCurrencyKey(inputCurrency), [inputCurrency])
  const dstKey = useMemo(() => generateCurrencyKey(actionCurrency), [actionCurrency])
  const destinationCallsKey = useMemo(
    () => generateDestinationCallsKey(destinationCalls),
    [destinationCalls]
  )

  const validation = useQuoteValidation(slippage)

  const shouldFetchQuotes = useMemo(() => {
    return !txInProgress && autoRefreshEnabled && Boolean(srcAmount && actionCurrency)
  }, [txInProgress, autoRefreshEnabled, srcAmount, actionCurrency])

  const handleQuotesChange = useCallback(
    (newQuotes: Quote[]) => {
      if (txInProgress) {
        return
      }

      if (newQuotes.length === 0) {
        setSelectedQuoteIndex(0)
        isUserSelectionRef.current = false
        return
      }

      setSelectedQuoteIndex((prevIndex) => {
        const isValidIndex = prevIndex >= 0 && prevIndex < newQuotes.length
        const shouldPreserve = isValidIndex && isUserSelectionRef.current
        return shouldPreserve ? prevIndex : 0
      })

      if (!isUserSelectionRef.current) {
        isUserSelectionRef.current = false
      }
    },
    [txInProgress]
  )

  const actionInfo = useMemo(() => {
    if (!inputCurrency || !actionCurrency) return undefined

    const isSameChain = inputCurrency.chainId === actionCurrency.chainId

    if (destinationCalls && destinationCalls.length > 0) {
      return {
        actionType: destinationInfo?.actionId || 'action',
        actionLabel: destinationInfo?.actionLabel,
        actionId: destinationInfo?.actionId,
      }
    }

    if (isSameChain) {
      return {
        actionType: 'swap',
        actionLabel: 'Swap',
        actionId: 'swap',
      }
    }

    return {
      actionType: 'bridge',
      actionLabel: 'Bridge',
      actionId: 'bridge',
    }
  }, [inputCurrency, actionCurrency, destinationCalls, destinationInfo])

  const { quotes, quoting, amountWei, refreshQuotes, abortQuotes, clearQuotes } = useTradeQuotes({
    srcAmount,
    dstCurrency: actionCurrency,
    slippage,
    destinationCalls,
    onQuotesChange: handleQuotesChange,
    shouldFetch: shouldFetchQuotes,
    actionInfo,
  })

  useEffect(() => {
    if (prevSrcKeyRef.current !== srcKey || prevDstKeyRef.current !== dstKey) {
      if (quotes.length > 0 && !txInProgress) {
        clearQuotes()
        setSelectedQuoteIndex(0)
        isUserSelectionRef.current = false
      }
      prevSrcKeyRef.current = srcKey
      prevDstKeyRef.current = dstKey
      setAutoRefreshEnabled(true)
    }
  }, [srcKey, dstKey, quotes.length, txInProgress, clearQuotes])

  useEffect(() => {
    if (prevDestinationCallsKeyRef.current !== destinationCallsKey) {
      if (quotes.length > 0 && !txInProgress) {
        clearQuotes()
        setSelectedQuoteIndex(0)
        isUserSelectionRef.current = false
      }
      prevDestinationCallsKeyRef.current = destinationCallsKey
      setAutoRefreshEnabled(true)
    }
  }, [destinationCallsKey, quotes.length, txInProgress, clearQuotes])

  useEffect(() => {
    if (!srcAmount || !actionCurrency) {
      prevIsSameChainRef.current = null
      return
    }

    const isSameChain = srcAmount.currency.chainId === actionCurrency.chainId
    const wasSameChain = prevIsSameChainRef.current
    const transitionedBetweenBridgeAndSwap = detectChainTransition(isSameChain, wasSameChain)

    if (transitionedBetweenBridgeAndSwap) {
      console.debug('Transitioned between bridge and swap, clearing quote cache')
      clearQuotes()
      setSelectedQuoteIndex(0)
      isUserSelectionRef.current = false
      setAutoRefreshEnabled(true)
    }
    prevIsSameChainRef.current = isSameChain
  }, [srcAmount, actionCurrency, clearQuotes])

  useEffect(() => {
    if (txInProgress) {
      console.debug('Skipping quote fetch: transaction in progress')
      abortQuotes()
      prevTxInProgressRef.current = txInProgress
      return
    }

    if (prevTxInProgressRef.current && !txInProgress) {
      console.debug('Transaction completed, resetting quote cache')
      clearQuotes()
      setSelectedQuoteIndex(0)
      isUserSelectionRef.current = false
      setAutoRefreshEnabled(true)
    }
    prevTxInProgressRef.current = txInProgress
  }, [txInProgress, abortQuotes, clearQuotes])

  const wrappedSetSelectedQuoteIndex = useCallback((index: number) => {
    isUserSelectionRef.current = true
    setSelectedQuoteIndex(index)
    setAutoRefreshEnabled(false)
  }, [])

  const highSlippageLossWarning = validation.highSlippageLossWarning
  const currentBuffer = validation.currentBuffer

  const quoteTrace = useQuoteTrace()

  const selectedTrade = quotes[selectedQuoteIndex]?.trade
  const [preservedTrade, setPreservedTrade] = useState<typeof selectedTrade | undefined>(undefined)
  const [wasTransactionCancelled, setWasTransactionCancelled] = useState(false)
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

  const priceImpact = useMemo(() => {
    if (!selectedTrade || !amount || !quoteOut || !inputPrice || !actionTokenPrice) {
      return undefined
    }
    try {
      const inputValue = Number(amount) * inputPrice
      const expectedOutput = inputValue / actionTokenPrice
      const actualOutput = Number(quoteOut)

      if (expectedOutput <= 0 || actualOutput <= 0) return undefined

      const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100
      return Math.max(0, impact)
    } catch {
      return undefined
    }
  }, [selectedTrade, amount, quoteOut, inputPrice, actionTokenPrice])

  useEffect(() => {
    if (isSwapOrBridge) {
      setPriceImpact(priceImpact)
    }
  }, [priceImpact, setPriceImpact, isSwapOrBridge])

  const queryClient = useQueryClient()

  const setDestinationInfo: ActionHandler = useCallback(
    (
      currencyAmount: RawCurrencyAmount | undefined,
      receiverAddress: string | undefined,
      destinationCalls: ActionCall[],
      actionLabel?: string,
      actionId?: string,
      actionData?: any
    ) => {
      if (!currencyAmount) {
        setDestinationInfoState(undefined)
        setDestinationCalls([])
        const prevActionCurrency = actionCurrency
        setActionCurrency(undefined)
        if (prevActionCurrency) {
          setAmount('')
          setWasTransactionCancelled(false)
        }
        return
      }

      const actionCur = currencyAmount.currency as RawCurrency
      setActionCurrency(actionCur)

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        setDestinationInfoState(undefined)
        setDestinationCalls([])
        setActionCurrency(undefined)
        return
      }

      setDestinationInfoState({ currencyAmount, actionLabel, actionId, actionData })
      setDestinationCalls(destinationCalls)

      quoteTrace.addTrace({
        quotes: [],
        actionInfo: {
          actionType: actionId || 'action',
          actionLabel: actionLabel || 'Destination intent',
          actionId,
          destinationCalls,
        },
        requestInfo: {
          srcCurrency: inputCurrency,
          dstCurrency: currencyAmount.currency,
          amount: currencyAmount.amount.toString(),
          slippage,
        },
        success: true,
      })
    },
    [inputCurrency, slippage, quoteTrace]
  )

  const { calculatedInputAmount } = useDestinationReverseQuote({
    destinationAmount: destinationInfo?.currencyAmount,
    inputCurrency,
    inputPrice,
    actionTokenPrice,
    slippage,
    isLoadingPrices,
    onInputAmountChange: setAmount,
  })

  useEffect(() => {
    if (!actionCurrency && !wasTransactionCancelled) {
      clearQuotes()
      setPreservedTrade(undefined)
    }
    if (wasTransactionCancelled && actionCurrency) {
      setWasTransactionCancelled(false)
    }
  }, [actionCurrency, clearQuotes, wasTransactionCancelled])

  return (
    <div>
      <ActionsPanel
        resetKey={actionResetKey}
        srcCurrency={inputCurrency}
        dstCurrency={actionCurrency}
        currentChainId={currentChainId}
        setDestinationInfo={setDestinationInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={wrappedSetSelectedQuoteIndex}
        slippage={slippage}
        onSrcCurrencyChange={setInputCurrency}
        calculatedInputAmount={calculatedInputAmount}
        destinationInfo={destinationInfo}
        pricesData={pricesData}
        isLoadingPrices={isLoadingPrices}
        isFetchingPrices={isFetchingPrices}
      />

      {((tradeToUse && actionCurrency) || (destinationInfo && inputCurrency && actionCurrency)) && (
        <div className="mt-4 space-y-3">
          {highSlippageLossWarning && tradeToUse && (
            <div className="rounded-lg bg-warning/10 border border-warning p-3">
              <div className="flex items-start gap-2">
                <span className="text-warning text-lg">⚠️</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-warning">High Slippage Loss Warning</div>
                  <div className="text-xs text-warning/80 mt-1">
                    This trade has high slippage loss. Consider increasing your slippage tolerance
                    to ensure the transaction succeeds.
                  </div>
                  {currentBuffer > 0.003 && (
                    <div className="text-xs text-warning/70 mt-1">
                      Current buffer: {(currentBuffer * 100).toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <ExecuteButton
            trade={tradeToUse}
            srcCurrency={inputCurrency}
            dstCurrency={actionCurrency}
            amountWei={amountWei}
            hasActionCalls={destinationCalls?.length > 0}
            chains={chains}
            quoting={quoting && !tradeToUse}
            onDone={(hashes) => {
              if (hashes.src) {
                abortQuotes()
                if (inputCurrency?.chainId && address) {
                  queryClient.invalidateQueries({
                    queryKey: ['balances', address],
                  })
                }
                if (actionCurrency?.chainId && address) {
                  queryClient.invalidateQueries({
                    queryKey: ['balances', address],
                  })
                }
                setDestinationInfo(undefined, undefined, [])
                setActionResetKey((prev) => prev + 1)
                setPreservedTrade(undefined)
                setAmount('')
                setWasTransactionCancelled(false)
              }
            }}
            onTransactionStart={() => {
              if (selectedTrade) {
                setPreservedTrade(selectedTrade)
              }
              setTxInProgress(true)
              setWasTransactionCancelled(false)
            }}
            onTransactionEnd={() => {
              setTxInProgress(false)
              setWasTransactionCancelled(true)
              setPreservedTrade(undefined)
            }}
            onReset={() => {
              setAmount('')
              setTxInProgress(false)
              setPreservedTrade(undefined)
              setWasTransactionCancelled(false)
            }}
            onResetStateChange={onResetStateChange}
          />
        </div>
      )}
    </div>
  )
}
