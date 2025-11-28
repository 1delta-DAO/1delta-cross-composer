import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Address } from 'viem'
import { DUMMY_ADDRESS } from '../../lib/consts'
import { useToast } from '../../components/common/ToastHost'
import type { ActionCall } from '../../lib/types/actionCalls'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { usePriceQuery } from '../../hooks/prices/usePriceQuery'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'
import { useConnection } from 'wagmi'
import { fetchQuotes, type Quote } from './useQuoteFetcher'
import { useQuoteValidation } from './useQuoteValidation'
import { useQuoteRefreshHelpers, REFRESH_INTERVAL_MS } from './useQuoteRefresh'
import {
  generateDestinationCallsKey,
  generateQuoteKey,
  generateCurrencyKey,
  areQuoteKeysEqual,
} from './useTradeQuotes/stateHelpers'
import { validateInputs } from './useTradeQuotes/inputValidation'

export function useTradeQuotes({
  srcAmount,
  dstCurrency,
  slippage,
  destinationCalls,
  onQuotesChange,
  shouldFetch,
}: {
  srcAmount?: RawCurrencyAmount
  dstCurrency?: RawCurrency
  slippage: number
  destinationCalls?: ActionCall[]
  onQuotesChange?: (quotes: Quote[]) => void
  shouldFetch?: boolean
}) {
  const { address: userAddress } = useConnection()
  const receiverAddress = userAddress || DUMMY_ADDRESS
  const toast = useToast()

  const [quoting, setQuoting] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [amountWei, setAmountWei] = useState<string | undefined>(undefined)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const requestInProgressRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastQuotedKeyRef = useRef<string | null>(null)
  const lastQuotedAtRef = useRef<number>(0)

  const refreshHelpers = useQuoteRefreshHelpers()

  const validation = useQuoteValidation(slippage)

  const srcCurrency = useMemo(() => srcAmount?.currency, [srcAmount])
  const srcKey = useMemo(() => generateCurrencyKey(srcCurrency), [srcCurrency])
  const dstKey = useMemo(() => generateCurrencyKey(dstCurrency), [dstCurrency])
  const destinationCallsKey = useMemo(
    () => generateDestinationCallsKey(destinationCalls),
    [destinationCalls]
  )

  const axelarPriceCurrencies = useMemo(() => {
    const currencies: RawCurrency[] = []
    if (srcCurrency) currencies.push(srcCurrency)
    if (dstCurrency) currencies.push(dstCurrency)
    return currencies
  }, [srcCurrency, dstCurrency])

  const { data: axelarPrices } = usePriceQuery({
    currencies: axelarPriceCurrencies,
    enabled: axelarPriceCurrencies.length > 0,
  })

  const clearQuotes = useCallback(() => {
    setQuotes([])
    setQuoting(false)
    requestInProgressRef.current = false
    lastQuotedKeyRef.current = null
    refreshHelpers.cleanup()
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [refreshHelpers])

  useEffect(() => {
    if (!shouldFetch) {
      return
    }

    const inputValidation = validateInputs(srcAmount, dstCurrency)

    if (!inputValidation.isValid) {
      if (quotes.length > 0) {
        clearQuotes()
      }
      return
    }

    if (requestInProgressRef.current) {
      console.debug('Request already in progress, skipping...')
      return
    }

    const currentKey = generateQuoteKey(
      srcAmount,
      dstCurrency,
      slippage,
      receiverAddress,
      destinationCallsKey
    )

    const now = Date.now()
    const sameAsLast = areQuoteKeysEqual(lastQuotedKeyRef.current, currentKey)
    const elapsed = now - lastQuotedAtRef.current

    if (sameAsLast && elapsed < REFRESH_INTERVAL_MS) {
      console.debug('Skipping re-quote: inputs unchanged and refresh interval not reached')
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    let cancel = false
    requestInProgressRef.current = true
    setQuoting(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    refreshHelpers.clearRefreshTimeout()

    const fetchQuote = async () => {
      try {
        const isRefresh = areQuoteKeysEqual(lastQuotedKeyRef.current, currentKey)
        lastQuotedKeyRef.current = currentKey
        lastQuotedAtRef.current = Date.now()

        if (!srcAmount || !dstCurrency) {
          throw new Error('Failed to convert tokens to SDK format')
        }

        const allQuotes = await fetchQuotes({
          srcAmount,
          dstCurrency,
          slippage,
          receiverAddress: receiverAddress as Address,
          destinationCalls,
          controller,
          axelarPrices: (axelarPrices || {}) as PricesRecord,
        })

        if (cancel || controller.signal.aborted) {
          console.debug('Request cancelled or aborted')
          return
        }

        if (allQuotes.length > 0) {
          console.debug('Quotes received:', allQuotes.length)

          setAmountWei(srcAmount.amount.toString())

          setQuotes(allQuotes)
          onQuotesChange?.(allQuotes)

          validation.validateAndUpdateQuotes(allQuotes, isRefresh, false)
        } else {
          throw new Error('No quote available from any aggregator/bridge')
        }
      } catch (error) {
        if (cancel || controller.signal.aborted) {
          console.debug('Request cancelled during error handling')
          return
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quote'
        toast.showError(errorMessage)
        setQuotes([])
        if (shouldFetch) {
          onQuotesChange?.([])
        }
        console.error('Quote fetch error:', error)
      } finally {
        if (!cancel && !controller.signal.aborted) {
          setQuoting(false)
        }
        requestInProgressRef.current = false
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        if (!cancel && !controller.signal.aborted) {
          const scheduledKey = lastQuotedKeyRef.current
          refreshHelpers.scheduleRefresh(() => {
            if (scheduledKey === lastQuotedKeyRef.current) {
              setRefreshTrigger((prev) => prev + 1)
            }
          })
        }
      }
    }

    fetchQuote()

    return () => {
      cancel = true
      controller.abort()
      requestInProgressRef.current = false
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      refreshHelpers.cleanup()
    }
  }, [
    srcAmount,
    dstCurrency,
    userAddress,
    slippage,
    refreshTrigger,
    shouldFetch,
    srcCurrency,
    destinationCallsKey,
    destinationCalls,
    receiverAddress,
    axelarPrices,
    validation,
    refreshHelpers,
    clearQuotes,
    onQuotesChange,
    quotes.length,
    toast,
  ])

  const refreshQuotes = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const abortQuotes = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    refreshHelpers.cleanup()
    requestInProgressRef.current = false
    setQuoting(false)
    lastQuotedKeyRef.current = null
  }, [refreshHelpers])

  return {
    quotes,
    quoting,
    amountWei,
    refreshQuotes,
    abortQuotes,
    clearQuotes,
  }
}
