import { useState, useEffect, useRef, useMemo } from "react"
import type { Address } from "viem"
import type { GenericTrade } from "@1delta/lib-utils"
import { TradeType } from "@1delta/lib-utils"
import { getCurrency, convertAmountToWei } from "../../lib/trade-helpers/utils"
import { fetchAllAggregatorTrades } from "../../lib/trade-helpers/aggregatorSelector"
import { MOCK_RECEIVER_ADDRESS } from "../../lib/consts"
import { useToast } from "../../components/common/ToastHost"
import type { DestinationCall } from "../../lib/types/destinationAction"
import type { DeltaCall } from "@1delta/trade-sdk"
import { DeltaCallType } from "@1delta/trade-sdk/dist/types"
import { fetchAllBridgeTrades } from "../trade-helpers/bridgeSelector"
import type { RawCurrency } from "../../types/currency"

type Quote = { label: string; trade: GenericTrade }

export function useSwapQuotes({
  srcCurrency,
  dstCurrency,
  debouncedAmount,
  debouncedSrcKey,
  debouncedDstKey,
  slippage,
  userAddress,
  txInProgress,
  destinationCalls,
}: {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  debouncedAmount: string
  debouncedSrcKey: string
  debouncedDstKey: string
  slippage: number
  userAddress?: Address
  txInProgress: boolean
  destinationCalls?: DestinationCall[]
}) {
  const [quoting, setQuoting] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
  const [amountWei, setAmountWei] = useState<string | undefined>(undefined)
  const toast = useToast()

  const srcChainId = useMemo(() => srcCurrency?.chainId, [srcCurrency])
  const srcToken = useMemo(() => (srcCurrency?.address as Address | undefined), [srcCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId, [dstCurrency])
  const dstToken = useMemo(() => (dstCurrency?.address as Address | undefined), [dstCurrency])

  const requestInProgressRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const lastQuotedKeyRef = useRef<string | null>(null)
  const lastQuotedAtRef = useRef<number>(0)
  const refreshTickRef = useRef<number>(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prevSrcKeyRef = useRef<string>(debouncedSrcKey)
  const prevDstKeyRef = useRef<string>(debouncedDstKey)
  const prevIsSameChainRef = useRef<boolean | null>(null)
  const prevDestinationCallsKeyRef = useRef<string>("")

  useEffect(() => {
    if (prevSrcKeyRef.current !== debouncedSrcKey || prevDstKeyRef.current !== debouncedDstKey) {
      if (quotes.length > 0) {
        setQuotes([])
      }
      prevSrcKeyRef.current = debouncedSrcKey
      prevDstKeyRef.current = debouncedDstKey
    }
  }, [debouncedSrcKey, debouncedDstKey, quotes.length])

  const destinationCallsKey = JSON.stringify(
    (destinationCalls || []).map((c) => ({
      t: c.target.toLowerCase(),
      v: c.value ? c.value.toString() : "",
      dStart: c.calldata.slice(0, 10),
      dEnd: c.calldata.slice(-10),
      g: c.gasLimit ? c.gasLimit.toString() : "",
      ct: typeof c.callType === "number" ? c.callType : 0,
      ta: c.tokenAddress ? c.tokenAddress.toLowerCase() : "",
      bi: typeof c.balanceOfInjectIndex === "number" ? c.balanceOfInjectIndex : 0,
    })),
  )

  useEffect(() => {
    if (prevDestinationCallsKeyRef.current !== destinationCallsKey) {
      if (quotes.length > 0) {
        setQuotes([])
      }
      lastQuotedKeyRef.current = null
      prevDestinationCallsKeyRef.current = destinationCallsKey
    }
  }, [destinationCallsKey, quotes.length])

  const receiverAddress = userAddress || MOCK_RECEIVER_ADDRESS

  const prevTxInProgressRef = useRef(txInProgress)

  useEffect(() => {
    if (txInProgress) {
      console.debug("Skipping quote fetch: transaction in progress")
      setQuoting(false)
      requestInProgressRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      prevTxInProgressRef.current = txInProgress
      return
    }

    if (prevTxInProgressRef.current && !txInProgress) {
      console.debug("Transaction completed, resetting quote cache")
      lastQuotedKeyRef.current = null
      requestInProgressRef.current = false
      setQuoting(false)
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
      console.debug("Transitioned between bridge and swap, clearing quote cache")
      lastQuotedKeyRef.current = null
      requestInProgressRef.current = false
      setQuoting(false)
      setQuotes([])
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
    }
    prevIsSameChainRef.current = isSameChain

    if (!amountOk || !inputsOk) {
      setQuotes([])
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
      return
    }

    if (requestInProgressRef.current) {
      console.debug("Request already in progress, skipping...")
      return
    }

    const currentKey = `${debouncedAmount}|${debouncedSrcKey}|${debouncedDstKey}|${slippage}|${receiverAddress}|${destinationCallsKey}`
    const now = Date.now()
    const sameAsLast = lastQuotedKeyRef.current === currentKey
    const elapsed = now - lastQuotedAtRef.current
    const isRefreshTrigger = refreshTickRef.current === refreshTick

    if (lastQuotedKeyRef.current !== null && lastQuotedKeyRef.current !== currentKey) {
      lastQuotedKeyRef.current = null
    }

    if (sameAsLast && !transitionedBetweenBridgeAndSwap && elapsed < 30000 && isRefreshTrigger) {
      console.debug("Skipping re-quote: inputs unchanged and refresh interval not reached")
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

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }

    const fetchQuote = async () => {
      try {
        lastQuotedKeyRef.current = currentKey
        lastQuotedAtRef.current = Date.now()
        const fromCurrency = srcCurrency
        const toCurrency = dstCurrency

        if (!fromCurrency || !toCurrency) {
          throw new Error("Failed to convert tokens to SDK format")
        }

        const amountInWei = convertAmountToWei(debouncedAmount, fromCurrency.decimals)
        setAmountWei(amountInWei)
        const isSameChain = sc === dc

        console.debug("Fetching quote:", {
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
                  balanceOfInjectIndex: typeof c.balanceOfInjectIndex === "number" ? c.balanceOfInjectIndex : 0,
                }
              }

              return base
            })
            destinationGasLimit = destinationCalls.reduce((acc, c) => acc + (c.gasLimit || 0n), 0n)
          }

          const bridgeTrades = await fetchAllBridgeTrades(
            {
              slippage,
              tradeType: TradeType.EXACT_INPUT,
              fromCurrency,
              toCurrency,
              swapAmount: amountInWei,
              caller: receiverAddress,
              receiver: receiverAddress,
              order: "CHEAPEST",
              usePermit: true,
              ...(additionalCalls ? { additionalCalls } : {}),
              destinationGasLimit,
            } as any,
            controller,
          )
          console.log("All bridges received from trade-sdk:", { bridges: bridgeTrades.map((t) => t.bridge), bridgeTrades })
          allQuotes = bridgeTrades.map((t) => ({ label: t.bridge, trade: t.trade }))
        }

        if (cancel || controller.signal.aborted) {
          console.debug("Request cancelled or aborted")
          return
        }

        if (allQuotes.length > 0) {
          console.debug("Quotes received:", allQuotes.length)
          setQuotes(allQuotes)
          setSelectedQuoteIndex(0)
        } else {
          throw new Error("No quote available from any aggregator/bridge")
        }
      } catch (error) {
        if (cancel || controller.signal.aborted) {
          console.debug("Request cancelled during error handling")
          return
        }
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch quote"
        toast.showError(errorMessage)
        setQuotes([])
        console.error("Quote fetch error:", error)
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
          refreshTickRef.current = refreshTick + 1
          refreshTimeoutRef.current = setTimeout(() => {
            if (scheduledKey === lastQuotedKeyRef.current) {
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
    requestInProgressRef.current = false
    setQuoting(false)
    lastQuotedKeyRef.current = null
  }

  return {
    quotes,
    quoting,
    selectedQuoteIndex,
    setSelectedQuoteIndex,
    amountWei,
    refreshQuotes,
    abortQuotes,
  }
}
