import { useReducer, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { DUMMY_ADDRESS } from '../../lib/consts'
import { useToast } from '../../components/common/ToastHost'
import type { ActionCall } from '../../components/actions/shared/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { createQuoteKey, areKeysEqual } from '../utils/keyGenerator'
import {
  fetchQuotes,
  validateQuoteRequest,
  type Quote,
} from '../services/quoteService'
import {
  quoteReducer,
  initialQuoteState,
  getQuotes,
  getSelectedQuote,
  isFetching,
  isQuoteStale,
  type QuoteState,
} from '../stores/quoteStore'
import { useQuoteTrace } from '../../contexts/QuoteTraceContext'

const REFRESH_INTERVAL_MS = 30_000
const TRACE_QUOTING_ENABLED = import.meta.env.VITE_TRACE_QUOTING === 'true'

export interface QuoteManagerParams {
  srcAmount?: RawCurrencyAmount
  dstCurrency?: RawCurrency
  slippage: number
  destinationCalls?: ActionCall[]
  inputCalls?: ActionCall[]
  enabled?: boolean
  onQuotesChange?: (quotes: Quote[]) => void
  actionInfo?: {
    actionType?: string
    actionLabel?: string
    actionId?: string
  }
}

export interface QuoteManagerResult {
  quotes: Quote[]
  selectedQuote: Quote | undefined
  selectedIndex: number
  quoting: boolean
  amountWei: string | undefined
  selectQuote: (index: number) => void
  refreshQuotes: () => void
  abortQuotes: () => void
  clearQuotes: () => void
}

export function useQuoteManager(params: QuoteManagerParams): QuoteManagerResult {
  const {
    srcAmount,
    dstCurrency,
    slippage,
    destinationCalls,
    inputCalls,
    enabled = true,
    onQuotesChange,
    actionInfo,
  } = params

  const { address: userAddress } = useConnection()
  const receiverAddress = userAddress || DUMMY_ADDRESS
  const toast = useToast()
  const quoteTrace = useQuoteTrace()

  const [state, dispatch] = useReducer(quoteReducer, initialQuoteState)
  const abortRef = useRef<AbortController | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [amountWei, setAmountWei] = useMemoState<string | undefined>(undefined)

  const quoteKey = useMemo(() => {
    if (!srcAmount || !dstCurrency) return ''
    return createQuoteKey({
      srcAmount,
      dstCurrency,
      slippage,
      receiverAddress,
      destinationCalls,
      inputCalls,
    })
  }, [srcAmount, dstCurrency, slippage, receiverAddress, destinationCalls, inputCalls])

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const scheduleRefresh = useCallback(() => {
    clearRefreshTimer()
    refreshTimerRef.current = setTimeout(() => {
      dispatch({ type: 'INVALIDATE' })
    }, REFRESH_INTERVAL_MS)
  }, [clearRefreshTimer])

  const abortCurrentRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const clearQuotes = useCallback(() => {
    abortCurrentRequest()
    clearRefreshTimer()
    dispatch({ type: 'CLEAR' })
  }, [abortCurrentRequest, clearRefreshTimer])

  const refreshQuotes = useCallback(() => {
    dispatch({ type: 'INVALIDATE' })
  }, [])

  const abortQuotes = useCallback(() => {
    abortCurrentRequest()
    clearRefreshTimer()
    dispatch({ type: 'CLEAR' })
  }, [abortCurrentRequest, clearRefreshTimer])

  const selectQuote = useCallback((index: number) => {
    dispatch({ type: 'SELECT_QUOTE', index })
  }, [])

  useEffect(() => {
    if (!enabled || !quoteKey) {
      return
    }

    const validation = validateQuoteRequest(srcAmount, dstCurrency, inputCalls)
    if (!validation.isValid) {
      if (state.status !== 'idle') {
        clearQuotes()
      }
      return
    }

    if (state.status === 'fetching') {
      return
    }

    if (state.status === 'success' && areKeysEqual(state.key, quoteKey) && !isQuoteStale(state)) {
      return
    }

    abortCurrentRequest()
    clearRefreshTimer()

    const controller = new AbortController()
    abortRef.current = controller

    dispatch({ type: 'FETCH_START', key: quoteKey })

    const doFetch = async () => {
      try {
        if (!srcAmount || !dstCurrency) {
          throw new Error('Missing required quote parameters')
        }

        const allQuotes = await fetchQuotes(
          {
            srcAmount,
            dstCurrency,
            slippage,
            receiverAddress: receiverAddress as Address,
            destinationCalls,
            inputCalls,
          },
          controller.signal
        )

        if (controller.signal.aborted) return

        dispatch({ type: 'FETCH_SUCCESS', key: quoteKey, quotes: allQuotes })
        setAmountWei(srcAmount.amount.toString())
        onQuotesChange?.(allQuotes)

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

        scheduleRefresh()
      } catch (error) {
        if (controller.signal.aborted) return

        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quote'
        dispatch({ type: 'FETCH_ERROR', key: quoteKey, error: errorMessage })
        toast.showError(errorMessage)
        onQuotesChange?.([])

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
      }
    }

    doFetch()

    return () => {
      controller.abort()
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [
    enabled,
    quoteKey,
    srcAmount,
    dstCurrency,
    slippage,
    receiverAddress,
    destinationCalls,
    inputCalls,
    state.status,
    state.status === 'success' ? state.key : null,
    state.status === 'success' ? state.fetchedAt : null,
  ])

  useEffect(() => {
    return () => {
      clearRefreshTimer()
      abortCurrentRequest()
    }
  }, [clearRefreshTimer, abortCurrentRequest])

  const quotes = getQuotes(state)
  const selectedQuote = getSelectedQuote(state)
  const selectedIndex = state.status === 'success' ? state.selectedIndex : 0
  const quoting = isFetching(state)

  return {
    quotes,
    selectedQuote,
    selectedIndex,
    quoting,
    amountWei,
    selectQuote,
    refreshQuotes,
    abortQuotes,
    clearQuotes,
  }
}

function useMemoState<T>(initialValue: T): [T, (value: T) => void] {
  const ref = useRef(initialValue)
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  const setValue = useCallback((value: T) => {
    if (ref.current !== value) {
      ref.current = value
      forceUpdate()
    }
  }, [])

  return [ref.current, setValue]
}

export { type Quote } from '../services/quoteService'

