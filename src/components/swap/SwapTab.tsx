import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import type { Address, Hex } from "viem"
import { zeroAddress } from "viem"
import { useChainId, useSwitchChain } from "wagmi"
import { TokenSelectorModal } from "../modals/TokenSelectorModal"
import { useChainsRegistry } from "../../sdk/hooks/useChainsRegistry"
import { useTokenLists } from "../../hooks/useTokenLists"
import { useEvmBalances } from "../../hooks/balances/useEvmBalances"
import { useTokenBalance } from "../../hooks/balances/useTokenBalance"
import { useDexscreenerPrices } from "../../hooks/prices/useDexscreenerPrices"
import { useTokenPrice } from "../../hooks/prices/useTokenPrice"
import { useDebounce } from "../../hooks/useDebounce"
import { CurrencyHandler, SupportedChainId } from "../../sdk/types"
import type { RawCurrency, RawCurrencyAmount } from "../../types/currency"
import { useQueryClient } from "@tanstack/react-query"
import { useSlippage } from "../../contexts/SlippageContext"
import { useSwapQuotes } from "../../sdk/hooks/useSwapQuotes"
import { usePriceImpact } from "../../hooks/usePriceImpact"
import { TokenInputSection } from "./TokenInputSection"
import { TokenOutputSection } from "./TokenOutputSection"
import { QuoteDisplay } from "./QuoteDisplay"
import ExecuteButton from "./ExecuteButton"
import { ActionsPanel } from "./ActionsPanel"
import { formatDisplayAmount, getTokenPrice, pickPreferredToken } from "./swapUtils"
import type { DestinationActionConfig, DestinationCall } from "../../lib/types/destinationAction"
import { reverseQuote } from "../../lib/reverseQuote"

type PendingAction = {
  id: string
  config: DestinationActionConfig
  selector: Hex
  args: any[]
  value?: string
}

type Props = {
  userAddress?: Address
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}

const DEFAULT_SRC_CHAIN_ID = SupportedChainId.BASE
const DEFAULT_DST_CHAIN_ID = SupportedChainId.MOONBEAM

export function SwapTab({ userAddress, onResetStateChange }: Props) {
  const { data: chains } = useChainsRegistry()
  const { data: lists } = useTokenLists()
  const currentChainId = useChainId()
  // Single source of truth for chain+token
  const [srcCurrency, setSrcCurrency] = useState<RawCurrency | undefined>(undefined)
  const [dstCurrency, setDstCurrency] = useState<RawCurrency | undefined>(undefined)
  const [amount, setAmount] = useState("")

  // Derived chainIds (no extra state)
  const srcChainId = srcCurrency?.chainId ?? DEFAULT_SRC_CHAIN_ID
  const dstChainId = dstCurrency?.chainId ?? DEFAULT_DST_CHAIN_ID

  const srcTokensMap = srcChainId ? lists?.[srcChainId] || {} : {}
  const dstTokensMap = dstChainId ? lists?.[dstChainId] || {} : {}
  const srcAddrs = useMemo(() => (srcChainId ? (Object.keys(srcTokensMap) as Address[]).slice(0, 300) : []), [srcTokensMap, srcChainId])
  const dstAddrs = useMemo(() => (dstChainId ? (Object.keys(dstTokensMap) as Address[]).slice(0, 300) : []), [dstTokensMap, dstChainId])

  // Auto-preselect initial src/dst currencies if empty
  useEffect(() => {
    if (srcCurrency || !lists || !chains) return
    const native = chains?.[DEFAULT_SRC_CHAIN_ID]?.data?.nativeCurrency?.symbol
    const force = DEFAULT_SRC_CHAIN_ID === SupportedChainId.BASE ? "USDC" : undefined
    const tokensMap = lists[DEFAULT_SRC_CHAIN_ID] || {}
    const pick = pickPreferredToken(tokensMap, force || native)
    if (!pick) return
    const meta = tokensMap[pick.toLowerCase()]
    if (!meta) return
    setSrcCurrency({
      chainId: DEFAULT_SRC_CHAIN_ID,
      address: pick,
      decimals: meta.decimals ?? 18,
      symbol: meta.symbol,
    })
  }, [srcCurrency, lists, chains])

  useEffect(() => {
    if (dstCurrency || !lists || !chains) return
    const native = chains?.[DEFAULT_DST_CHAIN_ID]?.data?.nativeCurrency?.symbol
    const force = DEFAULT_DST_CHAIN_ID === SupportedChainId.MOONBEAM ? "GLMR" : undefined
    const tokensMap = lists[DEFAULT_DST_CHAIN_ID] || {}
    const pick = pickPreferredToken(tokensMap, force || native)
    if (!pick) return
    const meta = tokensMap[pick.toLowerCase()]
    if (!meta) return
    setDstCurrency({
      chainId: DEFAULT_DST_CHAIN_ID,
      address: pick,
      decimals: meta.decimals ?? 18,
      symbol: meta.symbol,
    })
  }, [dstCurrency, lists, chains])

  // Include zero address for native token balance
  const srcAddressesWithNative = useMemo(() => {
    if (!srcChainId || !userAddress) return []
    const addrs = [...srcAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [srcAddrs, srcChainId, userAddress])

  const { data: srcBalances } = useEvmBalances({
    chainId: srcChainId,
    userAddress,
    tokenAddresses: srcAddressesWithNative,
  })

  const srcPriceAddresses = useMemo(() => {
    if (!srcBalances?.[srcChainId] || !userAddress || !srcChainId) return []

    const addressesWithBalance: Address[] = []
    const wrapped = CurrencyHandler.wrappedAddressFromAddress(srcChainId, zeroAddress)

    for (const addr of srcAddressesWithNative) {
      const bal = srcBalances[srcChainId][addr.toLowerCase()]
      if (bal && Number(bal.value || 0) > 0) {
        if (addr.toLowerCase() === zeroAddress.toLowerCase() && wrapped) {
          if (!addressesWithBalance.includes(wrapped as Address)) {
            addressesWithBalance.push(wrapped as Address)
          }
        } else {
          if (!addressesWithBalance.includes(addr)) {
            addressesWithBalance.push(addr)
          }
        }
      }
    }

    return addressesWithBalance
  }, [srcBalances, srcChainId, srcAddressesWithNative, userAddress])

  const { data: srcPrices } = useDexscreenerPrices({
    chainId: srcChainId,
    addresses: srcPriceAddresses,
    enabled: srcPriceAddresses.length > 0,
  })

  const srcTokenPriceAddr = useMemo(() => {
    if (!srcCurrency) return undefined
    if (srcCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(srcCurrency.chainId, zeroAddress) as Address | undefined
    }
    return srcCurrency.address as Address
  }, [srcCurrency])

  const srcTokenPriceInCache = srcTokenPriceAddr && srcPrices?.[srcCurrency?.chainId || srcChainId]?.[srcTokenPriceAddr.toLowerCase()]

  const { price: srcTokenPriceOnDemand } = useTokenPrice({
    chainId: srcCurrency?.chainId || srcChainId,
    tokenAddress: srcTokenPriceAddr,
    enabled: Boolean(srcCurrency && !srcTokenPriceInCache),
  })

  const srcPricesMerged = useMemo(() => {
    const key = srcCurrency?.chainId || srcChainId
    const merged: Record<string, { usd: number }> = {
      ...(srcPrices?.[key] || {}),
    }
    if (srcTokenPriceAddr && srcTokenPriceOnDemand) {
      merged[srcTokenPriceAddr.toLowerCase()] = { usd: srcTokenPriceOnDemand }
    }
    return merged
  }, [srcPrices, srcCurrency, srcChainId, srcTokenPriceAddr, srcTokenPriceOnDemand])

  const dstAddressesWithNative = useMemo(() => {
    if (!dstChainId || !userAddress) return []
    const addrs = [...dstAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [dstAddrs, dstChainId, userAddress])

  const { data: dstBalances } = useEvmBalances({
    chainId: dstChainId,
    userAddress,
    tokenAddresses: dstAddressesWithNative,
  })

  const dstPriceAddresses = useMemo(() => {
    if (!dstBalances?.[dstChainId] || !userAddress || !dstChainId) return []

    const addressesWithBalance: Address[] = []
    const wrapped = CurrencyHandler.wrappedAddressFromAddress(dstChainId, zeroAddress)

    for (const addr of dstAddressesWithNative) {
      const bal = dstBalances[dstChainId][addr.toLowerCase()]
      if (bal && Number(bal.value || 0) > 0) {
        if (addr.toLowerCase() === zeroAddress.toLowerCase() && wrapped) {
          if (!addressesWithBalance.includes(wrapped as Address)) {
            addressesWithBalance.push(wrapped as Address)
          }
        } else {
          if (!addressesWithBalance.includes(addr)) {
            addressesWithBalance.push(addr)
          }
        }
      }
    }

    return addressesWithBalance
  }, [dstBalances, dstChainId, dstAddressesWithNative, userAddress])

  const { data: dstPrices } = useDexscreenerPrices({
    chainId: dstChainId,
    addresses: dstPriceAddresses,
    enabled: dstPriceAddresses.length > 0,
  })

  const dstTokenPriceAddr = useMemo(() => {
    if (!dstCurrency) return undefined
    if (dstCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(dstCurrency.chainId, zeroAddress) as Address | undefined
    }
    return dstCurrency.address as Address
  }, [dstCurrency])

  const dstTokenPriceInCache = dstTokenPriceAddr && dstPrices?.[dstCurrency?.chainId || dstChainId]?.[dstTokenPriceAddr.toLowerCase()]

  const { price: dstTokenPriceOnDemand } = useTokenPrice({
    chainId: dstCurrency?.chainId || dstChainId,
    tokenAddress: dstTokenPriceAddr,
    enabled: Boolean(dstCurrency && !dstTokenPriceInCache),
  })

  const dstPricesMerged = useMemo(() => {
    const key = dstCurrency?.chainId || dstChainId
    const merged: Record<string, { usd: number }> = {
      ...(dstPrices?.[key] || {}),
    }
    if (dstTokenPriceAddr && dstTokenPriceOnDemand) {
      merged[dstTokenPriceAddr.toLowerCase()] = { usd: dstTokenPriceOnDemand }
    }
    return merged
  }, [dstPrices, dstCurrency, dstChainId, dstTokenPriceAddr, dstTokenPriceOnDemand])

  // Individual balances for selected src/dst currencies
  const { data: srcTokenBalance } = useTokenBalance({
    chainId: srcCurrency?.chainId || srcChainId,
    userAddress,
    tokenAddress: srcCurrency?.address as Address | undefined,
  })

  const { data: dstTokenBalance } = useTokenBalance({
    chainId: dstCurrency?.chainId || dstChainId,
    userAddress,
    tokenAddress: dstCurrency?.address as Address | undefined,
  })

  const debouncedAmount = useDebounce(amount, 1000)
  const srcKey = useMemo(() => `${srcCurrency?.chainId || srcChainId}|${(srcCurrency?.address || "").toLowerCase()}`, [srcCurrency, srcChainId])
  const dstKey = useMemo(() => `${dstCurrency?.chainId || dstChainId}|${(dstCurrency?.address || "").toLowerCase()}`, [dstCurrency, dstChainId])
  const debouncedSrcKey = useDebounce(srcKey, 1000)
  const debouncedDstKey = useDebounce(dstKey, 1000)

  const { slippage, setPriceImpact } = useSlippage()
  const [txInProgress, setTxInProgress] = useState(false)
  const [destinationCalls, setDestinationCalls] = useState<DestinationCall[]>([])

  const { quotes, quoting, selectedQuoteIndex, setSelectedQuoteIndex, amountWei, refreshQuotes, abortQuotes } = useSwapQuotes({
    srcCurrency,
    dstCurrency,
    debouncedAmount,
    debouncedSrcKey,
    debouncedDstKey,
    slippage,
    userAddress,
    txInProgress,
    destinationCalls,
  })

  const selectedTrade = quotes[selectedQuoteIndex]?.trade

  const quoteOut = useMemo(() => {
    const trade = selectedTrade
    if (!trade?.outputAmount) return undefined
    try {
      const exact = CurrencyHandler.toExact(trade.outputAmount)
      return formatDisplayAmount(exact)
    } catch {
      return undefined
    }
  }, [selectedTrade])

  const priceImpact = usePriceImpact({
    selectedTrade,
    amount,
    quoteOut,
    srcToken: srcCurrency?.address as any,
    dstToken: dstCurrency?.address as any,
    srcChainId,
    dstChainId,
    srcPricesMerged,
    dstPricesMerged,
  })

  useEffect(() => {
    setPriceImpact(priceImpact)
  }, [priceImpact, setPriceImpact])

  const queryClient = useQueryClient()
  const [sellModalOpen, setSellModalOpen] = useState(false)
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const [modalSellQuery, setModalSellQuery] = useState("")
  const [modalBuyQuery, setModalBuyQuery] = useState("")

  const handleReset = useCallback(() => {
    setAmount("")
    setSrcCurrency(undefined)
    setDstCurrency(undefined)
    setDestinationCalls([])
    setTxInProgress(false)
    abortQuotes()
  }, [abortQuotes])

  const srcSymbol = srcCurrency?.symbol || "Token"
  const dstSymbol = quotes[selectedQuoteIndex]?.trade?.outputAmount?.currency?.symbol || dstCurrency?.symbol || "Token"

  const setDestinationInfo = useCallback(
    (currencyAmount: RawCurrencyAmount | undefined, receiverAddress: string | undefined, destinationCalls: DestinationCall[]) => {
      if (!currencyAmount) return

      const dstCur = currencyAmount.currency as RawCurrency
      setDstCurrency(dstCur)

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        return
      }

      const priceIn = srcCurrency ? getTokenPrice(srcCurrency.chainId, srcCurrency.address as Address, srcPricesMerged) : 1
      const priceOut = getTokenPrice(dstCur.chainId, dstCur.address as Address, dstPricesMerged)

      const decimalsOut = dstCur.decimals
      const amountIn = reverseQuote(decimalsOut, currencyAmount.amount.toString(), priceIn ?? 1, priceOut ?? 1)
      setAmount(amountIn)
      setDestinationCalls(destinationCalls)
    },
    [srcCurrency, srcPricesMerged, dstPricesMerged]
  )

  return (
    <div>
      <div className="relative">
        <TokenInputSection
          amount={amount}
          onAmountChange={setAmount}
          srcCurrency={srcCurrency}
          srcTokenBalance={srcTokenBalance}
          srcBalances={srcBalances}
          srcPricesMerged={srcPricesMerged}
          lists={lists}
          onTokenClick={() => setSellModalOpen(true)}
          onReset={handleReset}
          onPercentageClick={(p) => {
            const bal = srcTokenBalance
              ? CurrencyHandler.toExactNumber(srcTokenBalance)
              : srcCurrency
              ? srcBalances?.[srcCurrency.chainId]?.[srcCurrency.address.toLowerCase()]?.value
              : undefined
            const n = bal ? Number(bal) : 0
            setAmount(n > 0 ? ((n * p) / 100).toString() : "")
          }}
        />
        <div className="flex justify-center -my-4 relative z-10">
          <button
            type="button"
            className="btn rounded-2xl bg-base-100 border-2 border-base-100 shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => {
              setSrcCurrency(dstCurrency)
              setDstCurrency(srcCurrency)
            }}
          >
            <span style={{ fontSize: "30px" }}>↕</span>
          </button>
        </div>
        <TokenOutputSection
          quoteOut={quoteOut}
          dstCurrency={dstCurrency}
          dstTokenBalance={dstTokenBalance}
          dstPricesMerged={dstPricesMerged}
          lists={lists}
          onTokenClick={() => setBuyModalOpen(true)}
          slippage={slippage}
          quotes={quotes}
        />
        <QuoteDisplay
          quotes={quotes}
          selectedQuoteIndex={selectedQuoteIndex}
          onSelectQuote={setSelectedQuoteIndex}
          amount={amount}
          srcSymbol={srcSymbol}
          dstSymbol={dstSymbol}
          srcCurrency={srcCurrency}
          dstCurrency={dstCurrency}
          dstPricesMerged={dstPricesMerged}
          quoting={quoting}
          isBridge={(srcCurrency?.chainId ?? DEFAULT_SRC_CHAIN_ID) !== (dstCurrency?.chainId ?? DEFAULT_DST_CHAIN_ID)}
        />
      </div>

      {/* Selection Modals */}
      <TokenSelectorModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        currency={srcCurrency}
        onChainChange={(chainId) => {
          const tokensMap = lists?.[chainId] || {}
          const native = chains?.[chainId]?.data?.nativeCurrency?.symbol
          const force = chainId === SupportedChainId.BASE ? "USDC" : undefined
          const pick = pickPreferredToken(tokensMap, force || native)
          if (!pick) {
            setSrcCurrency(undefined)
            return
          }
          const meta = tokensMap[pick.toLowerCase()]
          if (!meta) {
            setSrcCurrency(undefined)
            return
          }
          setSrcCurrency({
            chainId,
            address: pick,
            decimals: meta.decimals ?? 18,
            symbol: meta.symbol,
          })
        }}
        onCurrencyChange={(currency) => {
          if (currency) {
            setSrcCurrency(currency as RawCurrency)
          } else {
            setSrcCurrency(undefined)
          }
        }}
        query={modalSellQuery}
        onQueryChange={setModalSellQuery}
        userAddress={userAddress}
      />
      <TokenSelectorModal
        open={buyModalOpen}
        onClose={() => setBuyModalOpen(false)}
        currency={dstCurrency}
        onChainChange={(chainId) => {
          const tokensMap = lists?.[chainId] || {}
          const native = chains?.[chainId]?.data?.nativeCurrency?.symbol
          const force = chainId === SupportedChainId.MOONBEAM ? "GLMR" : srcCurrency && srcCurrency.chainId === chainId ? "USDC" : undefined

          const pick = pickPreferredToken(tokensMap, force || native)
          if (!pick) {
            setDstCurrency(undefined)
            return
          }
          const meta = tokensMap[pick.toLowerCase()]
          if (!meta) {
            setDstCurrency(undefined)
            return
          }
          const next: RawCurrency = {
            chainId,
            address: pick,
            decimals: meta.decimals ?? 18,
            symbol: meta.symbol,
          }

          // prevent same token as src on same chain
          if (srcCurrency && srcCurrency.chainId === next.chainId && srcCurrency.address.toLowerCase() === next.address.toLowerCase()) {
            return
          }

          setDstCurrency(next)
        }}
        onCurrencyChange={(currency) => {
          if (currency) {
            const cur = currency as RawCurrency
            if (srcCurrency && srcCurrency.chainId === cur.chainId && srcCurrency.address.toLowerCase() === cur.address.toLowerCase()) {
              return
            }
            setDstCurrency(cur)
          } else {
            setDstCurrency(undefined)
          }
        }}
        query={modalBuyQuery}
        onQueryChange={setModalBuyQuery}
        userAddress={userAddress}
        excludeAddresses={
          srcCurrency && (srcCurrency.chainId === (dstCurrency?.chainId ?? DEFAULT_DST_CHAIN_ID) ? [srcCurrency.address as Address] : [])
        }
      />

      <ActionsPanel
        dstCurrency={dstCurrency}
        userAddress={userAddress}
        currentChainId={currentChainId}
        tokenLists={lists}
        setDestinationInfo={setDestinationInfo}
      />

      {quotes.length > 0 && selectedTrade && (
        <div className="mt-4">
          <ExecuteButton
            trade={selectedTrade}
            srcCurrency={srcCurrency}
            dstCurrency={dstCurrency}
            userAddress={userAddress}
            amountWei={amountWei}
            destinationCalls={destinationCalls}
            chains={chains}
            onDone={() => {
              if (srcCurrency?.chainId && userAddress) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", srcCurrency.chainId, userAddress],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", srcCurrency.chainId, userAddress],
                })
              }
              if (dstCurrency?.chainId && userAddress) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", dstCurrency.chainId, userAddress],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", dstCurrency.chainId, userAddress],
                })
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
