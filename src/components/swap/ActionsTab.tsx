import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { useChainId } from "wagmi"
import { useChainsRegistry } from "../../sdk/hooks/useChainsRegistry"
import { useTokenLists } from "../../hooks/useTokenLists"
import { useEvmBalances } from "../../hooks/balances/useEvmBalances"
import { usePriceQuery } from "../../hooks/prices/usePriceQuery"
import { useTokenPrice } from "../../hooks/prices/useTokenPrice"
import { useDebounce } from "../../hooks/useDebounce"
import { CurrencyHandler, SupportedChainId } from "../../sdk/types"
import type { RawCurrency, RawCurrencyAmount } from "../../types/currency"
import { getCurrency } from "../../lib/trade-helpers/utils"
import { useQueryClient } from "@tanstack/react-query"
import { useSlippage } from "../../contexts/SlippageContext"
import { useSwapQuotes } from "../../sdk/hooks/useSwapQuotes"
import { usePriceImpact } from "../../hooks/usePriceImpact"
import ExecuteButton from "./ExecuteButton"
import { ActionsPanel } from "./ActionsPanel"
import { formatDisplayAmount, getTokenPrice, pickPreferredToken } from "./swapUtils"
import type { DestinationCall } from "../../lib/types/destinationAction"
import { reverseQuote } from "../../lib/reverseQuote"
import type { DestinationActionSelectorRef } from "../DestinationActionSelector"

type Props = {
  userAddress?: Address
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}

const DEFAULT_INPUT_CHAIN_ID = SupportedChainId.BASE

export function ActionsTab({ userAddress, onResetStateChange }: Props) {
  const { data: chains } = useChainsRegistry()
  const { data: lists } = useTokenLists()
  const currentChainId = useChainId()

  const [inputCurrency, setInputCurrency] = useState<RawCurrency | undefined>(undefined)
  const [actionCurrency, setActionCurrency] = useState<RawCurrency | undefined>(undefined)
  const [amount, setAmount] = useState("")
  const [calculatedInputAmount, setCalculatedInputAmount] = useState<string>("")
  const [destinationInfo, setDestinationInfoState] = useState<{ currencyAmount?: RawCurrencyAmount } | undefined>(undefined)

  const inputChainId = inputCurrency?.chainId ?? DEFAULT_INPUT_CHAIN_ID
  const actionChainId = actionCurrency?.chainId

  const inputTokensMap = inputChainId ? lists?.[inputChainId] || {} : {}
  const inputAddrs = useMemo(() => (inputChainId ? (Object.keys(inputTokensMap) as Address[]).slice(0, 300) : []), [inputTokensMap, inputChainId])

  useEffect(() => {
    if (inputCurrency || !lists || !chains) return
    const native = chains?.[DEFAULT_INPUT_CHAIN_ID]?.data?.nativeCurrency?.symbol
    const force = DEFAULT_INPUT_CHAIN_ID === SupportedChainId.BASE ? "USDC" : undefined
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
    if (!inputChainId || !userAddress) return []
    const addrs = [...inputAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [inputAddrs, inputChainId, userAddress])

  const { data: inputBalances } = useEvmBalances({
    chainId: inputChainId,
    userAddress,
    tokenAddresses: inputAddressesWithNative,
  })

  const inputPriceCurrencies = useMemo(() => {
    if (!inputBalances?.[inputChainId] || !userAddress || !inputChainId) return []

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
  }, [inputBalances, inputChainId, inputAddressesWithNative, userAddress])

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

  const { price: inputTokenPriceOnDemand } = useTokenPrice({
    chainId: inputCurrency?.chainId || inputChainId,
    tokenAddress: inputTokenPriceAddr,
    enabled: Boolean(inputCurrency && !inputTokenPriceInCache),
  })

  const inputPricesMerged = useMemo(() => {
    const key = inputCurrency?.chainId || inputChainId
    const merged: Record<string, { usd: number }> = {
      ...(inputPrices?.[key] || {}),
    }
    if (inputTokenPriceAddr && inputTokenPriceOnDemand) {
      merged[inputTokenPriceAddr.toLowerCase()] = { usd: inputTokenPriceOnDemand }
    }
    return merged
  }, [inputPrices, inputCurrency, inputChainId, inputTokenPriceAddr, inputTokenPriceOnDemand])

  const actionPriceCurrencies = useMemo(() => {
    if (!actionCurrency || !userAddress || !actionChainId) return []
    return [actionCurrency]
  }, [actionCurrency, userAddress, actionChainId])

  const { data: actionPrices } = usePriceQuery({
    currencies: actionPriceCurrencies,
    enabled: actionPriceCurrencies.length > 0,
  })

  const actionTokenPriceAddr = useMemo(() => {
    if (!actionCurrency) return undefined
    if (actionCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(actionCurrency.chainId, zeroAddress) as Address | undefined
    }
    return actionCurrency.address as Address
  }, [actionCurrency])

  const actionTokenPriceInCache =
    actionTokenPriceAddr && actionPrices?.[actionCurrency?.chainId || actionChainId || ""]?.[actionTokenPriceAddr.toLowerCase()]

  const { price: actionTokenPriceOnDemand } = useTokenPrice({
    chainId: actionCurrency?.chainId || actionChainId || "1",
    tokenAddress: actionTokenPriceAddr,
    enabled: Boolean(actionCurrency && !actionTokenPriceInCache),
  })

  const actionPricesMerged = useMemo(() => {
    if (!actionCurrency || !actionChainId) return {}
    const key = actionChainId
    const merged: Record<string, { usd: number }> = {
      ...(actionPrices?.[key] || {}),
    }
    if (actionTokenPriceAddr && actionTokenPriceOnDemand) {
      merged[actionTokenPriceAddr.toLowerCase()] = { usd: actionTokenPriceOnDemand }
    }
    return merged
  }, [actionPrices, actionCurrency, actionChainId, actionTokenPriceAddr, actionTokenPriceOnDemand])

  const debouncedAmount = useDebounce(amount, 1000)
  const inputKey = useMemo(
    () => `${inputCurrency?.chainId || inputChainId}|${(inputCurrency?.address || "").toLowerCase()}`,
    [inputCurrency, inputChainId]
  )
  const actionKey = useMemo(
    () => `${actionCurrency?.chainId || actionChainId}|${(actionCurrency?.address || "").toLowerCase()}`,
    [actionCurrency, actionChainId]
  )
  const debouncedInputKey = useDebounce(inputKey, 1000)
  const debouncedActionKey = useDebounce(actionKey, 1000)

  const { slippage, setPriceImpact } = useSlippage()
  const [txInProgress, setTxInProgress] = useState(false)
  const [destinationCalls, setDestinationCalls] = useState<DestinationCall[]>([])
  const actionSelectorRef = useRef<DestinationActionSelectorRef>(null)

  const isSwapOrBridge = useMemo(() => {
    return Boolean(inputCurrency && actionCurrency)
  }, [inputCurrency, actionCurrency])

  const { quotes, quoting, selectedQuoteIndex, setSelectedQuoteIndex, amountWei, refreshQuotes, abortQuotes } = useSwapQuotes({
    srcCurrency: inputCurrency,
    dstCurrency: actionCurrency,
    debouncedAmount,
    debouncedSrcKey: debouncedInputKey,
    debouncedDstKey: debouncedActionKey,
    slippage,
    userAddress,
    txInProgress,
    destinationCalls,
  })

  const selectedTrade = quotes[selectedQuoteIndex]?.trade

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
    srcPricesMerged: inputPricesMerged,
    dstPricesMerged: actionPricesMerged,
  })

  useEffect(() => {
    if (isSwapOrBridge) {
      setPriceImpact(priceImpact)
    }
  }, [priceImpact, setPriceImpact, isSwapOrBridge])

  const queryClient = useQueryClient()

  const setDestinationInfo = useCallback(
    (currencyAmount: RawCurrencyAmount | undefined, receiverAddress: string | undefined, destinationCalls: DestinationCall[]) => {
      if (!currencyAmount) {
        setDestinationInfoState(undefined)
        setCalculatedInputAmount("")
        setDestinationCalls([])
        return
      }

      const actionCur = currencyAmount.currency as RawCurrency
      setActionCurrency(actionCur)

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        setDestinationInfoState(undefined)
        setCalculatedInputAmount("")
        setDestinationCalls([])
        return
      }

      const priceIn = inputCurrency ? getTokenPrice(inputCurrency.chainId, inputCurrency.address as Address, inputPricesMerged) : 1
      const priceOut = getTokenPrice(actionCur.chainId, actionCur.address as Address, actionPricesMerged)

      const decimalsOut = actionCur.decimals
      const amountIn = reverseQuote(decimalsOut, currencyAmount.amount.toString(), priceIn ?? 1, priceOut ?? 1)

      setCalculatedInputAmount(amountIn)
      setDestinationInfoState({ currencyAmount })
      setDestinationCalls(destinationCalls)

      setAmount(amountIn)
    },
    [inputCurrency, inputPricesMerged, actionPricesMerged]
  )

  return (
    <div>
      <ActionsPanel
        ref={actionSelectorRef}
        srcCurrency={inputCurrency}
        dstCurrency={actionCurrency}
        userAddress={userAddress}
        currentChainId={currentChainId}
        tokenLists={lists}
        setDestinationInfo={setDestinationInfo}
        quotes={quotes}
        srcPricesMerged={inputPricesMerged}
        dstPricesMerged={actionPricesMerged}
        slippage={slippage}
        onSrcCurrencyChange={setInputCurrency}
        calculatedInputAmount={calculatedInputAmount}
        destinationInfo={destinationInfo}
      />

      {quotes.length > 0 && selectedTrade && (
        <div className="mt-4">
          <ExecuteButton
            trade={selectedTrade}
            srcCurrency={inputCurrency}
            dstCurrency={actionCurrency}
            userAddress={userAddress}
            amountWei={amountWei}
            destinationCalls={destinationCalls}
            chains={chains}
            onDone={(hashes) => {
              if (inputCurrency?.chainId && userAddress) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", inputCurrency.chainId, userAddress],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", inputCurrency.chainId, userAddress],
                })
              }
              if (actionCurrency?.chainId && userAddress) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", actionCurrency.chainId, userAddress],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", actionCurrency.chainId, userAddress],
                })
              }
              setDestinationInfo(undefined, undefined, [])

              if (hashes.src) {
                actionSelectorRef.current?.reset()
              }
            }}
            onTransactionStart={() => {
              setTxInProgress(true)
              abortQuotes()
            }}
            onTransactionEnd={() => {
              setTxInProgress(false)
            }}
            onReset={() => {
              setAmount("")
              setTxInProgress(false)
            }}
            onResetStateChange={onResetStateChange}
          />
        </div>
      )}
    </div>
  )
}
