import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useWeb3 } from '../../contexts/Web3Context'
import { usePriceQuery } from '../../hooks/prices/usePriceQuery'
import { CurrencyHandler, SupportedChainId } from '../../sdk/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { useTradeContext } from '../../contexts/TradeContext'
import { ReverseActionsPanel } from './ReverseActionsPanel'
import type { ActionCall } from '../actions/shared/types'
import { ActionHandler } from '../actions/shared/types'
import { useQuoteTrace } from '../../contexts/QuoteTraceContext'
import { useTradeQuotes } from '../../sdk/hooks/useTradeQuotes'
import type { Quote } from '../../sdk/hooks/useQuoteFetcher'
import ExecuteButton from './ExecuteButton'
import { useQueryClient } from '@tanstack/react-query'
import { isLendingAction } from '../actions/lending/utils/isLendingAction'
import { refreshUserLendingBalances } from '../actions/lending/withdraw/balanceCache'
import { getCachedMarkets } from '../actions/lending/shared/marketCache'
import type { Address } from 'viem'

type Props = {
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}

const DEFAULT_DESTINATION_CHAIN_ID = SupportedChainId.BASE

export function ReverseActionsTab({ onResetStateChange }: Props) {
  const { address, currentChainId, chains } = useWeb3()
  const { slippage, route, setSrcAmount, setDstAmount, setCalls, inputCalls, clearCalls } =
    useTradeContext()

  const destinationCurrency = route.dstAmount?.currency as RawCurrency | undefined
  const inputActionCurrency = route.srcAmount?.currency as RawCurrency | undefined
  const [inputInfo, setInputInfoState] = useState<
    { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string } | undefined
  >(undefined)
  const [actionResetKey, setActionResetKey] = useState(0)
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
  const [txInProgress, setTxInProgress] = useState(false)
  const isUserSelectionRef = useRef<boolean>(false)

  const destinationChainId = destinationCurrency?.chainId ?? DEFAULT_DESTINATION_CHAIN_ID
  const inputActionChainId = inputActionCurrency?.chainId

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

    addCurrency(destinationCurrency)
    addCurrency(inputActionCurrency)

    return currencies
  }, [destinationCurrency, inputActionCurrency])

  const {
    data: pricesData,
    isLoading: isLoadingPrices,
    isFetching: isFetchingPrices,
  } = usePriceQuery({
    currencies: allCurrenciesForPrice,
    enabled: allCurrenciesForPrice.length > 0,
  })

  const destinationPrice = useMemo(() => {
    if (!destinationCurrency || !pricesData) return undefined
    const chainId = destinationCurrency.chainId || destinationChainId
    const priceKey = destinationCurrency.address.toLowerCase()
    return pricesData[chainId]?.[priceKey]?.usd
  }, [destinationCurrency, pricesData, destinationChainId])

  const inputActionTokenPrice = useMemo(() => {
    if (!inputActionCurrency || !pricesData) return undefined
    const chainId = inputActionCurrency.chainId || inputActionChainId
    const priceKey = inputActionCurrency.address.toLowerCase()
    return pricesData[chainId!]?.[priceKey]?.usd
  }, [inputActionCurrency, pricesData, inputActionChainId])

  const quoteTrace = useQuoteTrace()
  const queryClient = useQueryClient()

  const srcAmount = useMemo(() => route.srcAmount, [route.srcAmount])

  const shouldFetchQuotes = useMemo(() => {
    return !txInProgress && Boolean(srcAmount && destinationCurrency)
  }, [txInProgress, srcAmount, destinationCurrency])

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
    if (!inputActionCurrency || !destinationCurrency) return undefined

    const isSameChain = inputActionCurrency.chainId === destinationCurrency.chainId

    if (inputCalls && inputCalls.length > 0) {
      return {
        actionType: inputInfo?.actionId || 'action',
        actionLabel: inputInfo?.actionLabel,
        actionId: inputInfo?.actionId,
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
  }, [inputActionCurrency, destinationCurrency, inputCalls, inputInfo])

  const { quotes, quoting, amountWei, clearQuotes, abortQuotes } = useTradeQuotes({
    srcAmount,
    dstCurrency: destinationCurrency,
    slippage,
    inputCalls,
    onQuotesChange: handleQuotesChange,
    shouldFetch: shouldFetchQuotes,
    actionInfo,
  })

  const wrappedSetSelectedQuoteIndex = useCallback((index: number) => {
    isUserSelectionRef.current = true
    setSelectedQuoteIndex(index)
  }, [])

  const selectedTrade = quotes[selectedQuoteIndex]?.trade
  const [preservedTrade, setPreservedTrade] = useState<typeof selectedTrade | undefined>(undefined)
  const tradeToUse = preservedTrade || selectedTrade

  const setInputInfo = useCallback<ActionHandler>(
    (
      currencyAmount: RawCurrencyAmount | undefined,
      receiverAddress: string | undefined,
      inputCalls: ActionCall[],
      actionLabel?: string,
      actionId?: string
    ) => {
      if (!currencyAmount) {
        setInputInfoState(undefined)
        clearCalls()
        setSrcAmount(undefined)
        return
      }

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        setInputInfoState(undefined)
        clearCalls()
        setSrcAmount(undefined)
        return
      }

      setInputInfoState({ currencyAmount, actionLabel, actionId })
      setSrcAmount(currencyAmount)
      setCalls(inputCalls)

      quoteTrace.addTrace({
        quotes: [],
        actionInfo: {
          actionType: actionId || 'action',
          actionLabel: actionLabel || 'Input intent',
          actionId,
          destinationCalls: inputCalls,
        },
        requestInfo: {
          srcCurrency: currencyAmount.currency,
          dstCurrency: destinationCurrency,
          amount: currencyAmount.amount.toString(),
          slippage,
        },
        success: true,
      })
    },
    [destinationCurrency, slippage, quoteTrace, clearCalls, setSrcAmount, setCalls]
  )

  const handleTransactionDone = useCallback(
    (hashes: { src?: string; dst?: string; completed?: boolean }) => {
      if (hashes.src) {
        abortQuotes()
        if (inputActionCurrency?.chainId && address) {
          queryClient.invalidateQueries({
            queryKey: ['balances', address],
          })
        }
        if (destinationCurrency?.chainId && address) {
          queryClient.invalidateQueries({
            queryKey: ['balances', address],
          })
        }

        if (
          address &&
          (inputActionCurrency?.chainId || destinationCurrency?.chainId) &&
          isLendingAction(inputCalls)
        ) {
          const chainId = inputActionCurrency?.chainId || destinationCurrency?.chainId
          const markets = getCachedMarkets()
          if (chainId && markets) {
            refreshUserLendingBalances(chainId, address as Address, markets).catch(console.error)
          }
        }

        setInputInfo(undefined, undefined, [])
        setActionResetKey((prev) => prev + 1)
        setPreservedTrade(undefined)
      }
    },
    [
      abortQuotes,
      inputActionCurrency,
      destinationCurrency,
      address,
      queryClient,
      setInputInfo,
      inputInfo,
      inputCalls,
    ]
  )

  const handleTransactionStart = useCallback(() => {
    if (selectedTrade) {
      setPreservedTrade(selectedTrade)
    }
    setTxInProgress(true)
  }, [selectedTrade])

  const handleTransactionEnd = useCallback(() => {
    setTxInProgress(false)
    setPreservedTrade(undefined)
  }, [])

  const handleReset = useCallback(() => {
    setTxInProgress(false)
    setPreservedTrade(undefined)
  }, [])

  return (
    <div>
      <ReverseActionsPanel
        resetKey={actionResetKey}
        srcCurrency={inputActionCurrency}
        dstCurrency={destinationCurrency}
        currentChainId={currentChainId}
        setActionInfo={setInputInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={wrappedSetSelectedQuoteIndex}
        slippage={slippage}
        onDstCurrencyChange={(currency) => {
          setDstAmount(CurrencyHandler.fromRawAmount(currency, 0n))
        }}
        calculatedInputAmount={undefined}
        actionInfo={inputInfo}
        pricesData={pricesData}
        isLoadingPrices={isLoadingPrices}
        isFetchingPrices={isFetchingPrices}
      />

      {((tradeToUse && inputActionCurrency) ||
        (inputInfo && inputActionCurrency && destinationCurrency)) && (
        <div className="mt-4 space-y-3">
          <ExecuteButton
            trade={tradeToUse}
            srcCurrency={inputActionCurrency}
            dstCurrency={destinationCurrency}
            amountWei={amountWei}
            hasActionCalls={(inputCalls?.length ?? 0) > 0}
            inputCalls={inputCalls}
            chains={chains}
            quoting={quoting}
            onDone={handleTransactionDone}
            onTransactionStart={handleTransactionStart}
            onTransactionEnd={handleTransactionEnd}
            onReset={handleReset}
          />
        </div>
      )}
    </div>
  )
}
