import { useState, useEffect, useRef } from "react"
import type { Address, Hex } from "viem"
import type { GenericTrade } from "@1delta/lib-utils"
import { SupportedChainId, TradeType } from "@1delta/lib-utils"
import { getCurrency, convertAmountToWei } from "../lib/trade-helpers/utils"
import { fetchAllAggregatorTrades } from "../lib/trade-helpers/aggregatorSelector"
import { fetchAllBridgeTrades } from "../lib/trade-helpers/bridgeSelector"
import { MOCK_RECEIVER_ADDRESS } from "../lib/consts"
import { useToast } from "../components/common/ToastHost"
import type { DestinationCall } from "../lib/types/destinationAction"

type Quote = { label: string; trade: GenericTrade }

export function useSwapQuotes({
    srcChainId,
    srcToken,
    dstChainId,
    dstToken,
    debouncedAmount,
    debouncedSrcKey,
    debouncedDstKey,
    slippage,
    userAddress,
    txInProgress,
    destinationCalls,
}: {
    srcChainId?: string
    srcToken?: Address
    dstChainId?: string
    dstToken?: Address
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

    // Use ref to track if a request is in progress to prevent duplicate calls
    const requestInProgressRef = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Track last quoted key and schedule re-quote
    const lastQuotedKeyRef = useRef<string | null>(null)
    const lastQuotedAtRef = useRef<number>(0)
    const refreshTickRef = useRef<number>(0)
    const [refreshTick, setRefreshTick] = useState(0)
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Track previous keys to detect changes
    const prevSrcKeyRef = useRef<string>(debouncedSrcKey)
    const prevDstKeyRef = useRef<string>(debouncedDstKey)
    const prevIsSameChainRef = useRef<boolean | null>(null)
    const prevDestinationCallsKeyRef = useRef<string>("")

    // Clear quotes immediately when token/chain changes (before debounce completes)
    // This ensures UI feedback is immediate while still debouncing the actual fetch
    useEffect(() => {
        // If keys changed, clear quotes immediately
        if (prevSrcKeyRef.current !== debouncedSrcKey || prevDstKeyRef.current !== debouncedDstKey) {
            // Only clear if we had quotes before
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
        }))
    )

    // Track previous txInProgress to detect when transaction completes
    const prevTxInProgressRef = useRef(txInProgress)

    const receiverAddress = userAddress || MOCK_RECEIVER_ADDRESS

    // Quote on input changes (keep prior quote visible while updating)
    useEffect(() => {
        if (prevDestinationCallsKeyRef.current !== destinationCallsKey) {
            if (quotes.length > 0) {
                setQuotes([])
            }
            lastQuotedKeyRef.current = null
            prevDestinationCallsKeyRef.current = destinationCallsKey
        }

        // Stop fetching quotes if transaction is in progress
        if (txInProgress) {
            console.debug("Skipping quote fetch: transaction in progress")
            // Reset state when transaction starts
            setQuoting(false)
            requestInProgressRef.current = false
            // Abort any pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
            }
            prevTxInProgressRef.current = txInProgress
            return
        }

        // When transaction completes (txInProgress goes from true to false), reset cache to allow re-quoting
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

        // Detect transition between bridge and swap (cross-chain to same-chain or vice versa)
        const isSameChain = sc === dc
        const wasSameChain = prevIsSameChainRef.current
        const transitionedBetweenBridgeAndSwap = wasSameChain !== null && wasSameChain !== isSameChain

        if (transitionedBetweenBridgeAndSwap) {
            console.debug("Transitioned between bridge and swap, clearing quote cache")
            lastQuotedKeyRef.current = null
            requestInProgressRef.current = false
            setQuoting(false)
            // Clear quotes when transitioning
            setQuotes([])
            // Abort any pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
            }
            // Clear any scheduled refresh
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
            // Clear last quoted key when inputs are invalid
            lastQuotedKeyRef.current = null
            // Abort any pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
            }
            // Clear any scheduled refresh
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
                refreshTimeoutRef.current = null
            }
            return
        }

        // Prevent duplicate requests
        if (requestInProgressRef.current) {
            console.debug("Request already in progress, skipping...")
            return
        }

        // Prevent unnecessary re-quote if nothing changed and 30s not elapsed
        const currentKey = `${debouncedAmount}|${debouncedSrcKey}|${debouncedDstKey}|${slippage}|${receiverAddress}|${destinationCallsKey}`
        const now = Date.now()
        const sameAsLast = lastQuotedKeyRef.current === currentKey
        const elapsed = now - lastQuotedAtRef.current
        const isRefreshTrigger = refreshTickRef.current === refreshTick

        // If key changed, clear the last quoted key to force a new quote
        if (lastQuotedKeyRef.current !== null && lastQuotedKeyRef.current !== currentKey) {
            lastQuotedKeyRef.current = null
        }

        // Skip re-quote only if same key AND not transitioning AND within refresh interval
        if (sameAsLast && !transitionedBetweenBridgeAndSwap && elapsed < 30000 && isRefreshTrigger) {
            console.debug("Skipping re-quote: inputs unchanged and refresh interval not reached")
            return
        }

        // Abort previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        let cancel = false
        requestInProgressRef.current = true
        setQuoting(true)

        // Create abort controller for this quote request
        const controller = new AbortController()
        abortControllerRef.current = controller

        // Clear any scheduled refresh while quoting
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
            refreshTimeoutRef.current = null
        }

        const fetchQuote = async () => {
            try {
                lastQuotedKeyRef.current = currentKey
                lastQuotedAtRef.current = Date.now()
                const fromCurrency = getCurrency(sc!, st!)
                const toCurrency = getCurrency(dc!, dt!)

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
                    // Same-chain swap: get all aggregator quotes
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
                        controller
                    )
                    allQuotes = trades.map((t) => ({ label: t.aggregator.toString(), trade: t.trade }))
                } else {
                    let additionalCalls: Array<{ callType: 0; target: string; value?: bigint; callData: Hex }> | undefined
                    let destinationGasLimit: bigint | undefined
                    if (destinationCalls && destinationCalls.length > 0) {
                        additionalCalls = destinationCalls.map((c) => ({
                            callType: 0,
                            target: c.target,
                            value: c.value && c.value > 0n ? c.value : undefined,
                            callData: c.calldata,
                        })) as any
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
                        controller
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
                // Schedule next refresh in 30s if inputs unchanged
                if (!cancel && !controller.signal.aborted) {
                    const scheduledKey = lastQuotedKeyRef.current
                    refreshTickRef.current = refreshTick + 1
                    refreshTimeoutRef.current = setTimeout(() => {
                        // Only trigger if inputs (keys) unchanged
                        if (scheduledKey === lastQuotedKeyRef.current) {
                            setRefreshTick((x) => x + 1)
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
        srcChainId,
        srcToken,
        dstChainId,
        dstToken,
        destinationCallsKey,
        destinationCalls,
        receiverAddress,
    ])

    const refreshQuotes = () => {
        setRefreshTick((x) => x + 1)
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
        // Clear last quoted key to allow re-quoting
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
