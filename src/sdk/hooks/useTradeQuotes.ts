import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Address } from 'viem'
import { DUMMY_ADDRESS } from '../../lib/consts'
import { useToast } from '../../components/common/ToastHost'
import type { ActionCall } from '../../components/actions/shared/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { useAccount } from 'wagmi'
import { fetchQuotes, type Quote } from './useQuoteFetcher'
import { useQuoteValidation } from './useQuoteValidation'
import { useQuoteRefreshHelpers, REFRESH_INTERVAL_MS } from './useQuoteRefresh'
import {
  hashActionCalls,
  createQuoteKey,
  areKeysEqual,
} from '../utils/keyGenerator'
import { validateQuoteRequest } from '../services/quoteService'
import { useQuoteTrace } from '../../contexts/QuoteTraceContext'

const TRACE_QUOTING_ENABLED = import.meta.env.VITE_TRACE_QUOTING === 'true'

export function useTradeQuotes({
  srcAmount,
  dstCurrency,
  slippage,
  destinationCalls,
  inputCalls,
  onQuotesChange,
  shouldFetch,
  actionInfo,
}: {
  srcAmount?: RawCurrencyAmount
  dstCurrency?: RawCurrency
  slippage: number
  destinationCalls?: ActionCall[]
  inputCalls?: ActionCall[]
  onQuotesChange?: (quotes: Quote[]) => void
  shouldFetch?: boolean
  actionInfo?: {
    actionType?: string
    actionLabel?: string
    actionId?: string
  }
}) {
  const { address: userAddress } = useAccount()
  const receiverAddress = userAddress || DUMMY_ADDRESS
  const toast = useToast()

  const quoteTrace = useQuoteTrace()

  const [quoting, setQuoting] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [amountWei, setAmountWei] = useState<string | undefined>(undefined)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const requestInProgressRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastQuotedKeyRef = useRef<string | null>(null)
  const lastQuotedAtRef = useRef<number>(0)

  const { clearRefreshTimeout, scheduleRefresh, cleanup } = useQuoteRefreshHelpers()

  const validation = useQuoteValidation(slippage)
  const { validateAndUpdateQuotes } = validation

  const srcCurrency = useMemo(() => srcAmount?.currency, [srcAmount])

  const destinationCallsKey = useMemo(
    () => hashActionCalls(destinationCalls),
    [destinationCalls]
  )

  const inputCallsKey = useMemo(() => hashActionCalls(inputCalls), [inputCalls])

  const clearQuotes = useCallback(() => {
    setQuotes([])
    setQuoting(false)
    requestInProgressRef.current = false
    lastQuotedKeyRef.current = null
    cleanup()
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [cleanup])

  useEffect(() => {
    if (!shouldFetch) {
      return
    }

    const inputValidation = validateQuoteRequest(srcAmount, dstCurrency, inputCalls)

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

    const currentKey = createQuoteKey({
      srcAmount,
      dstCurrency,
      slippage,
      receiverAddress,
      destinationCalls,
      inputCalls,
    })

    const now = Date.now()
    const sameAsLast = areKeysEqual(lastQuotedKeyRef.current, currentKey)
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

    clearRefreshTimeout()

    const fetchQuote = async () => {
      try {
        const isRefresh = areKeysEqual(lastQuotedKeyRef.current, currentKey)
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
          inputCalls,
          controller,
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

          validateAndUpdateQuotes(allQuotes, isRefresh, false)

          if (TRACE_QUOTING_ENABLED) {
            quoteTrace.addTrace({
              quotes: allQuotes,
              actionInfo: {
                actionType: actionInfo?.actionType,
                actionLabel: actionInfo?.actionLabel,
                actionId: actionInfo?.actionId,
                destinationCalls,
              },
              requestInfo: {
                srcCurrency: srcAmount.currency,
                dstCurrency,
                amount: srcAmount.amount.toString(),
                slippage,
              },
              success: true,
            })
          }
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

        if (TRACE_QUOTING_ENABLED && srcAmount && dstCurrency) {
          quoteTrace.addTrace({
            quotes: [],
            error: errorMessage,
            actionInfo: {
              actionType: actionInfo?.actionType,
              actionLabel: actionInfo?.actionLabel,
              actionId: actionInfo?.actionId,
              destinationCalls,
            },
            requestInfo: {
              srcCurrency: srcAmount.currency,
              dstCurrency,
              amount: srcAmount.amount.toString(),
              slippage,
            },
            success: false,
          })
        }
      } finally {
        const isCurrent = abortControllerRef.current === controller

        if (isCurrent) {
          requestInProgressRef.current = false
        }

        if (isCurrent) {
          setQuoting(false)
        }

        if (isCurrent && !cancel && !controller.signal.aborted) {
          const scheduledKey = lastQuotedKeyRef.current
          scheduleRefresh(() => {
            if (scheduledKey === lastQuotedKeyRef.current) {
              setRefreshTrigger((prev) => prev + 1)
            }
          })
        }

        if (isCurrent) {
          abortControllerRef.current = null
        }
      }
    }

    fetchQuote()

    return () => {
      cancel = true
      controller.abort()
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      requestInProgressRef.current = false
      setQuoting(false)
      cleanup()
    }
  }, [
    srcAmount,
    dstCurrency,
    slippage,
    refreshTrigger,
    shouldFetch,
    destinationCallsKey,
    inputCallsKey,
    receiverAddress,
    validateAndUpdateQuotes,
    clearRefreshTimeout,
    scheduleRefresh,
    cleanup,
    clearQuotes,
    onQuotesChange,
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
    cleanup()
    requestInProgressRef.current = false
    setQuoting(false)
    lastQuotedKeyRef.current = null
  }, [cleanup])

  return {
    quotes,
    quoting,
    amountWei,
    refreshQuotes,
    abortQuotes,
    clearQuotes,
  }
}
