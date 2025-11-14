import { useState, useEffect, useRef } from "react"
import type { Address, Hex } from "viem"
import type { GenericTrade } from "@1delta/lib-utils"
import { SupportedChainId, TradeType } from "@1delta/lib-utils"
import { getCurrency, convertAmountToWei } from "../trade-helpers/utils"
import { fetchAllAggregatorTrades } from "../trade-helpers/aggregatorSelector"
import { fetchAllBridgeTrades } from "../trade-helpers/bridgeSelector"
import { CALL_PERMIT_PRECOMPILE } from "../../lib/consts"
import { useToast } from "../../components/common/ToastHost"

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
    attachedMessage,
    attachedGasLimit,
    attachedValue,
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
    attachedMessage?: Hex
    attachedGasLimit?: bigint
    attachedValue?: bigint
}) {
    const [quoting, setQuoting] = useState(false)
    const [quotes, setQuotes] = useState<Quote[]>([])
    const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
    const [amountWei, setAmountWei] = useState<string | undefined>(undefined)
    const toast = useToast()

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
    const prevAttachedMessageRef = useRef<Hex | undefined>(attachedMessage)

    useEffect(() => {
        if (prevSrcKeyRef.current !== debouncedSrcKey || prevDstKeyRef.current !== debouncedDstKey) {
            if (quotes.length > 0) {
                setQuotes([])
            }
            prevSrcKeyRef.current = debouncedSrcKey
            prevDstKeyRef.current = debouncedDstKey
        }
    }, [debouncedSrcKey, debouncedDstKey, quotes.length])

    useEffect(() => {
        if (prevAttachedMessageRef.current !== attachedMessage) {
            if (quotes.length > 0) {
                setQuotes([])
            }
            lastQuotedKeyRef.current = null
            prevAttachedMessageRef.current = attachedMessage
        }
    }, [attachedMessage, quotes.length])

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
        const inputsOk = Boolean(debouncedSrcKey && debouncedDstKey && sc && st && dc && dt && userAddress)

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

        const messageKey = attachedMessage ? `${attachedMessage.length}|${attachedMessage.slice(0, 10)}|${attachedMessage.slice(-10)}` : ""
        const gasLimitKey = attachedGasLimit ? attachedGasLimit.toString() : ""
        const valueKey = attachedValue ? attachedValue.toString() : ""
        const currentKey = `${debouncedAmount}|${debouncedSrcKey}|${debouncedDstKey}|${slippage}|${
            userAddress || ""
        }|${messageKey}|${gasLimitKey}|${valueKey}`
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
                    const trades = await fetchAllAggregatorTrades(
                        sc!,
                        {
                            chainId: sc!,
                            fromCurrency,
                            toCurrency,
                            swapAmount: amountInWei,
                            slippage,
                            caller: userAddress!,
                            receiver: userAddress!,
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
                    if (dc === SupportedChainId.MOONBEAM && attachedMessage) {
                        additionalCalls = [
                            {
                                callType: 0, // DEFAULT
                                target: CALL_PERMIT_PRECOMPILE as Address,
                                value: (attachedValue ?? 0n) as any,
                                callData: attachedMessage as Hex,
                            },
                        ] as any
                        destinationGasLimit = attachedGasLimit
                    }

                    const bridgeTrades = await fetchAllBridgeTrades(
                        {
                            slippage,
                            tradeType: TradeType.EXACT_INPUT,
                            fromCurrency,
                            toCurrency,
                            swapAmount: amountInWei,
                            caller: userAddress!,
                            receiver: userAddress!,
                            order: "CHEAPEST",
                            usePermit: true,
                            ...(additionalCalls ? { additionalCalls } : attachedMessage ? { message: attachedMessage as string } : {}),
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
        srcChainId,
        srcToken,
        dstChainId,
        dstToken,
        attachedMessage,
        attachedGasLimit,
        attachedValue,
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
