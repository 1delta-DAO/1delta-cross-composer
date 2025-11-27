import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Address } from 'viem'
import type { GenericTrade } from '@1delta/lib-utils'
import { TradeType } from '@1delta/lib-utils'
import { convertAmountToWei } from '../../lib/trade-helpers/utils'
import { fetchAllAggregatorTrades } from '../../lib/trade-helpers/aggregatorSelector'
import { DUMMY_ADDRESS } from '../../lib/consts'
import { useToast } from '../../components/common/ToastHost'
import type { DestinationCall } from '../../lib/types/destinationAction'
import type { DeltaCall } from '@1delta/trade-sdk'
import { DeltaCallType } from '@1delta/trade-sdk/dist/types'
import { fetchAllActionTrades } from '../trade-helpers/actionSelector'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { useConnection } from 'wagmi'
import { validateQuoteOutput, calculateAdjustedBuffer, calculateReverseQuoteBuffer } from '../../lib/reverseQuote'

type Quote = { label: string; trade: GenericTrade }

export function useTradeQuotes({
  srcCurrency,
  dstCurrency,
  debouncedAmount,
  debouncedSrcKey,
  debouncedDstKey,
  slippage,
  txInProgress,
  destinationCalls,
  minRequiredAmount,
  enableRequoting,
}: {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  debouncedAmount: string
  debouncedSrcKey: string
  debouncedDstKey: string
  slippage: number
  txInProgress: boolean
  destinationCalls?: DestinationCall[]
  minRequiredAmount?: RawCurrencyAmount
  enableRequoting?: boolean
}) {
  const { address: userAddress } = useConnection()
  const receiverAddress = userAddress || DUMMY_ADDRESS

  const [quoting, setQuoting] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
  const [amountWei, setAmountWei] = useState<string | undefined>(undefined)
  const [highSlippageLossWarning, setHighSlippageLossWarning] = useState(false)
  const [currentBuffer, setCurrentBuffer] = useState<number>(calculateReverseQuoteBuffer(slippage))
  const toast = useToast()

  const srcChainId = useMemo(() => srcCurrency?.chainId, [srcCurrency])
  const srcToken = useMemo(() => srcCurrency?.address as Address | undefined, [srcCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId, [dstCurrency])
  const dstToken = useMemo(() => dstCurrency?.address as Address | undefined, [dstCurrency])

  const requestInProgressRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const lastQuotedKeyRef = useRef<string | null>(null)
  const lastQuotedAtRef = useRef<number>(0)
  const refreshTickRef = useRef<number>(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requotingStartTimeRef = useRef<number | null>(null)
  const requotingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prevSrcKeyRef = useRef<string>(debouncedSrcKey)
  const prevDstKeyRef = useRef<string>(debouncedDstKey)
  const prevIsSameChainRef = useRef<boolean | null>(null)
  const prevDestinationCallsKeyRef = useRef<string>('')
  const isUserSelectionRef = useRef<boolean>(false)

  useEffect(() => {
    if (prevSrcKeyRef.current !== debouncedSrcKey || prevDstKeyRef.current !== debouncedDstKey) {
      if (quotes.length > 0 && !txInProgress) {
        setQuotes([])
        setSelectedQuoteIndex(0)
        isUserSelectionRef.current = false
      }
      prevSrcKeyRef.current = debouncedSrcKey
      prevDstKeyRef.current = debouncedDstKey
    }
  }, [debouncedSrcKey, debouncedDstKey, quotes.length, txInProgress])

  const destinationCallsKey = JSON.stringify(
    (destinationCalls || []).map((c) => ({
      t: c.target ? c.target.toLowerCase() : '',
      v: c.value ? c.value.toString() : '',
      dStart: c.calldata ? c.calldata.slice(0, 10) : '',
      dEnd: c.calldata ? c.calldata.slice(-10) : '',
      g: c.gasLimit ? c.gasLimit.toString() : '',
      ct: typeof c.callType === 'number' ? c.callType : 0,
      ta: c.tokenAddress ? c.tokenAddress.toLowerCase() : '',
      bi: typeof c.balanceOfInjectIndex === 'number' ? c.balanceOfInjectIndex : 0,
    })),
  )

  useEffect(() => {
    if (prevDestinationCallsKeyRef.current !== destinationCallsKey) {
      if (quotes.length > 0 && !txInProgress) {
        setQuotes([])
        setSelectedQuoteIndex(0)
        isUserSelectionRef.current = false
      }
      if (!txInProgress) {
        lastQuotedKeyRef.current = null
      }
      prevDestinationCallsKeyRef.current = destinationCallsKey
    }
  }, [destinationCallsKey, quotes.length, txInProgress])

  const prevTxInProgressRef = useRef(txInProgress)

  useEffect(() => {
    if (txInProgress) {
      console.debug('Skipping quote fetch: transaction in progress')
      setQuoting(false)
      requestInProgressRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (requotingTimeoutRef.current) {
        clearTimeout(requotingTimeoutRef.current)
        requotingTimeoutRef.current = null
      }
      requotingStartTimeRef.current = null
      prevTxInProgressRef.current = txInProgress
      return
    }

    if (prevTxInProgressRef.current && !txInProgress) {
      console.debug('Transaction completed, resetting quote cache')
      lastQuotedKeyRef.current = null
      requestInProgressRef.current = false
      setQuoting(false)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (requotingTimeoutRef.current) {
        clearTimeout(requotingTimeoutRef.current)
        requotingTimeoutRef.current = null
      }
      requotingStartTimeRef.current = null
    }
    prevTxInProgressRef.current = txInProgress

    const [sc, st] = [srcChainId, srcToken]
    const [dc, dt] = [dstChainId, dstToken]
    const amountOk = Boolean(debouncedAmount) && Number(debouncedAmount) > 0
    const inputsOk = Boolean(debouncedSrcKey && debouncedDstKey && sc && st && dc && dt)

    const isSameChain = sc === dc
    const wasSameChain = prevIsSameChainRef.current
    const transitionedBetweenBridgeAndSwap = wasSameChain !== null && wasSameChain !== isSameChain

    if (transitionedBetweenBridgeAndSwap) {
      console.debug('Transitioned between bridge and swap, clearing quote cache')
      lastQuotedKeyRef.current = null
      requestInProgressRef.current = false
      setQuoting(false)
      setQuotes([])
      setSelectedQuoteIndex(0)
      isUserSelectionRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (requotingTimeoutRef.current) {
        clearTimeout(requotingTimeoutRef.current)
        requotingTimeoutRef.current = null
      }
      requotingStartTimeRef.current = null
    }
    prevIsSameChainRef.current = isSameChain

    if (!amountOk || !inputsOk) {
      setQuotes([])
      setSelectedQuoteIndex(0)
      isUserSelectionRef.current = false
      setQuoting(false)
      requestInProgressRef.current = false
      lastQuotedKeyRef.current = null
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (requotingTimeoutRef.current) {
        clearTimeout(requotingTimeoutRef.current)
        requotingTimeoutRef.current = null
      }
      requotingStartTimeRef.current = null
      return
    }

    if (requestInProgressRef.current) {
      console.debug('Request already in progress, skipping...')
      return
    }

    const currentKey = `${debouncedAmount}|${debouncedSrcKey}|${debouncedDstKey}|${slippage}|${receiverAddress}|${destinationCallsKey}`
    const now = Date.now()
    const sameAsLast = lastQuotedKeyRef.current === currentKey
    const elapsed = now - lastQuotedAtRef.current
    const isRefreshTrigger = refreshTickRef.current === refreshTick

    if (lastQuotedKeyRef.current !== null && lastQuotedKeyRef.current !== currentKey) {
      lastQuotedKeyRef.current = null
      isUserSelectionRef.current = false
      requotingStartTimeRef.current = null
      if (requotingTimeoutRef.current) {
        clearTimeout(requotingTimeoutRef.current)
        requotingTimeoutRef.current = null
      }
    }

    if (sameAsLast && !transitionedBetweenBridgeAndSwap && elapsed < 30000 && isRefreshTrigger) {
      console.debug('Skipping re-quote: inputs unchanged and refresh interval not reached')
      return
    }

    const nowForTimeout = Date.now()
    if (requotingStartTimeRef.current === null) {
      requotingStartTimeRef.current = nowForTimeout
    } else {
      const elapsedRequoting = nowForTimeout - requotingStartTimeRef.current
      if (elapsedRequoting >= 120000) {
        console.debug('Requoting timeout reached (2 minutes), stopping to prevent API rate limiting')
        setQuoting(false)
        requestInProgressRef.current = false
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
        }
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
          refreshTimeoutRef.current = null
        }
        if (requotingTimeoutRef.current) {
          clearTimeout(requotingTimeoutRef.current)
          requotingTimeoutRef.current = null
        }
        requotingStartTimeRef.current = null
        return
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    let cancel = false
    requestInProgressRef.current = true
    setQuoting(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }

    const fetchQuote = async () => {
      try {
        const isRefresh = lastQuotedKeyRef.current === currentKey
        lastQuotedKeyRef.current = currentKey
        lastQuotedAtRef.current = Date.now()
        const fromCurrency = srcCurrency
        const toCurrency = dstCurrency

        if (!fromCurrency || !toCurrency) {
          throw new Error('Failed to convert tokens to SDK format')
        }

        const amountInWei = convertAmountToWei(debouncedAmount, fromCurrency.decimals)
        setAmountWei(amountInWei)
        const isSameChain = sc === dc

        console.debug('Fetching quote:', {
          isSameChain,
          chainId: sc,
          fromCurrency: fromCurrency.symbol,
          toCurrency: toCurrency.symbol,
          amount: debouncedAmount,
          amountInWei,
          slippage,
        })

        let allQuotes: Quote[] = []

        if (isSameChain) {
          const trades = await fetchAllAggregatorTrades(
            sc!,
            {
              chainId: sc!,
              fromCurrency,
              toCurrency,
              swapAmount: amountInWei,
              slippage,
              caller: receiverAddress,
              receiver: receiverAddress,
              tradeType: TradeType.EXACT_INPUT,
              flashSwap: false,
              usePermit: true,
            } as any,
            controller,
          )
          allQuotes = trades.map((t) => ({ label: t.aggregator.toString(), trade: t.trade }))
        } else {
          let additionalCalls: DeltaCall[] | undefined
          let destinationGasLimit: bigint | undefined
          if (destinationCalls && destinationCalls.length > 0) {
            additionalCalls = destinationCalls.map((c) => {
              const callType = c.callType ?? DeltaCallType.DEFAULT
              const base: DeltaCall = {
                callType,
                target: c.target,
                value: c.value && c.value > 0n ? c.value : undefined,
                callData: c.calldata,
              }

              if (callType === DeltaCallType.FULL_TOKEN_BALANCE) {
                return {
                  ...base,
                  tokenAddress: c.tokenAddress,
                  balanceOfInjectIndex: typeof c.balanceOfInjectIndex === 'number' ? c.balanceOfInjectIndex : 0,
                }
              }

              return base
            })
            destinationGasLimit = destinationCalls.reduce((acc, c) => acc + (c.gasLimit || 0n), 0n)
          }

          const actionTrades = await fetchAllActionTrades(
            {
              slippage,
              tradeType: TradeType.EXACT_INPUT,
              fromCurrency,
              toCurrency,
              swapAmount: amountInWei,
              caller: receiverAddress,
              receiver: receiverAddress,
              order: 'CHEAPEST',
              usePermit: true,
              ...(additionalCalls ? { additionalCalls } : {}),
              destinationGasLimit,
            } as any,
            controller,
          )
          console.log('All actions received from trade-sdk:', { actions: actionTrades.map((t) => t.action), actionTrades })
          allQuotes = actionTrades.map((t) => ({ label: t.action, trade: t.trade }))
        }

        if (cancel || controller.signal.aborted) {
          console.debug('Request cancelled or aborted')
          return
        }

        if (allQuotes.length > 0) {
          console.debug('Quotes received:', allQuotes.length)
          requotingStartTimeRef.current = null
          if (requotingTimeoutRef.current) {
            clearTimeout(requotingTimeoutRef.current)
            requotingTimeoutRef.current = null
          }

          const updateQuotesAndSelection = () => {
            setQuotes(allQuotes)
            setSelectedQuoteIndex((prevIndex) => {
              const isValidIndex = prevIndex >= 0 && prevIndex < allQuotes.length
              const shouldPreserve = isRefresh && isValidIndex && isUserSelectionRef.current
              return shouldPreserve ? prevIndex : 0
            })
            if (!isRefresh || !isUserSelectionRef.current) {
              isUserSelectionRef.current = false
            }
          }

          if (enableRequoting && minRequiredAmount && allQuotes.length > 0) {
            const bestQuote = allQuotes[0]
            const outputAmount = bestQuote.trade.outputAmountRealized
            const validation = validateQuoteOutput(outputAmount, minRequiredAmount)

            if (!validation.isValid) {
              console.debug('Quote validation failed:', validation)

              if (validation.hasHighSlippageLoss) {
                setHighSlippageLossWarning(true)
                setCurrentBuffer(0.05)
                updateQuotesAndSelection()
              } else {
                const adjustedBuffer = calculateAdjustedBuffer(currentBuffer, validation.requiredBuffer, slippage)
                setCurrentBuffer(adjustedBuffer)
                setHighSlippageLossWarning(false)

                if (adjustedBuffer > currentBuffer) {
                  console.debug('Buffer adjusted, but quotes already fetched. Validation warning may apply.')
                }

                updateQuotesAndSelection()
              }
            } else {
              setHighSlippageLossWarning(false)
              updateQuotesAndSelection()
            }
          } else {
            setHighSlippageLossWarning(false)
            updateQuotesAndSelection()
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
        setSelectedQuoteIndex(0)
        isUserSelectionRef.current = false
        console.error('Quote fetch error:', error)
      } finally {
        if (!cancel && !controller.signal.aborted) {
          setQuoting(false)
        }
        requestInProgressRef.current = false
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        if (!cancel && !controller.signal.aborted && !txInProgress) {
          const scheduledKey = lastQuotedKeyRef.current
          refreshTickRef.current = refreshTick + 1
          refreshTimeoutRef.current = setTimeout(() => {
            if (scheduledKey === lastQuotedKeyRef.current && !txInProgress) {
              setRefreshTick((x: number) => x + 1)
            }
          }, 30000)
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
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (requotingTimeoutRef.current) {
        clearTimeout(requotingTimeoutRef.current)
        requotingTimeoutRef.current = null
      }
    }
  }, [
    debouncedAmount,
    debouncedSrcKey,
    debouncedDstKey,
    userAddress,
    slippage,
    refreshTick,
    txInProgress,
    srcCurrency,
    dstCurrency,
    destinationCallsKey,
    destinationCalls,
    receiverAddress,
    minRequiredAmount,
    enableRequoting,
  ])

  const refreshQuotes = () => {
    setRefreshTick((x: number) => x + 1)
  }

  const abortQuotes = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
    if (requotingTimeoutRef.current) {
      clearTimeout(requotingTimeoutRef.current)
      requotingTimeoutRef.current = null
    }
    requestInProgressRef.current = false
    setQuoting(false)
    lastQuotedKeyRef.current = null
    requotingStartTimeRef.current = null
  }

  useEffect(() => {
    if (enableRequoting && minRequiredAmount && quotes.length > 0 && selectedQuoteIndex < quotes.length) {
      const selectedQuote = quotes[selectedQuoteIndex]
      const outputAmount = selectedQuote.trade.outputAmountRealized
      const validation = validateQuoteOutput(outputAmount, minRequiredAmount)

      if (validation.hasHighSlippageLoss) {
        setHighSlippageLossWarning(true)
      } else {
        setHighSlippageLossWarning(false)
      }
    } else {
      setHighSlippageLossWarning(false)
    }
  }, [quotes, selectedQuoteIndex, minRequiredAmount, enableRequoting])

  useEffect(() => {
    setCurrentBuffer(calculateReverseQuoteBuffer(slippage))
  }, [slippage])

  const wrappedSetSelectedQuoteIndex = useCallback((index: number) => {
    isUserSelectionRef.current = true
    setSelectedQuoteIndex(index)
  }, [])

  return {
    quotes,
    quoting,
    selectedQuoteIndex,
    setSelectedQuoteIndex: wrappedSetSelectedQuoteIndex,
    amountWei,
    refreshQuotes,
    abortQuotes,
    highSlippageLossWarning,
    currentBuffer,
  }
}
