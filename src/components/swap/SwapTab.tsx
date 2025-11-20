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
import { CurrencyHandler, RawCurrency, SupportedChainId } from "../../sdk/types"
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

const DEFAULT_BUFFER_BPS = 50

export function SwapTab({ userAddress, onResetStateChange }: Props) {
  const { data: chains } = useChainsRegistry()
  const { data: lists } = useTokenLists()
  const currentChainId = useChainId()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const [srcChainId, setSrcChainId] = useState<string | undefined>("8453") // Base chain
  const [dstChainId, setDstChainId] = useState<string | undefined>(SupportedChainId.MOONBEAM)
  const [srcToken, setSrcToken] = useState<Address | undefined>(undefined)
  const [dstToken, setDstToken] = useState<Address | undefined>(undefined)
  const [amount, setAmount] = useState("")

  const srcTokensMap = srcChainId ? lists?.[srcChainId] || {} : {}
  const dstTokensMap = dstChainId ? lists?.[dstChainId] || {} : {}
  const srcAddrs = useMemo(() => (srcChainId ? (Object.keys(srcTokensMap) as Address[]).slice(0, 300) : []), [srcTokensMap, srcChainId])
  const dstAddrs = useMemo(() => (dstChainId ? (Object.keys(dstTokensMap) as Address[]).slice(0, 300) : []), [dstTokensMap, dstChainId])

  // Prevent chain flip during encoding/signing
  const [isEncoding, setIsEncoding] = useState(false)

  // Switch wallet chain when source chain changes
  useEffect(() => {
    if (!srcChainId || isEncoding) return
    const srcChainIdNum = Number(srcChainId)
    if (currentChainId !== srcChainIdNum) {
      try {
        switchChain({ chainId: srcChainIdNum })
      } catch (err: unknown) {
        console.warn("Failed to switch chain:", err)
      }
    }
  }, [srcChainId, currentChainId, switchChain, isEncoding])

  // Include zero address for native token balance
  const srcAddressesWithNative = useMemo(() => {
    if (!srcChainId || !userAddress) return []
    const addrs = [...srcAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [srcAddrs, srcChainId, userAddress])

  const { data: srcBalances, isLoading: srcBalancesLoading } = useEvmBalances({
    chainId: srcChainId || "",
    userAddress,
    tokenAddresses: srcAddressesWithNative,
  })

  const srcPriceAddresses = useMemo(() => {
    if (!srcBalances?.[srcChainId || ""] || !userAddress || !srcChainId) return []

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

  const { data: srcPrices, isLoading: srcPricesLoading } = useDexscreenerPrices({
    chainId: srcChainId || "",
    addresses: srcPriceAddresses,
    enabled: srcPriceAddresses.length > 0,
  })

  const srcTokenPriceAddr = useMemo(() => {
    if (!srcToken || !srcChainId) return undefined
    if (srcToken.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(srcChainId, zeroAddress) as Address | undefined
    }
    return srcToken
  }, [srcToken, srcChainId])

  const srcTokenPriceInCache = srcTokenPriceAddr && srcPrices?.[srcChainId || ""]?.[srcTokenPriceAddr.toLowerCase()]
  const { price: srcTokenPriceOnDemand, isLoading: srcTokenPriceOnDemandLoading } = useTokenPrice({
    chainId: srcChainId || "",
    tokenAddress: srcTokenPriceAddr,
    enabled: Boolean(srcToken && srcChainId && !srcTokenPriceInCache),
  })

  const srcPricesMerged = useMemo(() => {
    const merged = { ...srcPrices?.[srcChainId || ""] }
    if (srcTokenPriceAddr && srcTokenPriceOnDemand) {
      merged[srcTokenPriceAddr.toLowerCase()] = { usd: srcTokenPriceOnDemand }
    }
    return merged
  }, [srcPrices, srcChainId, srcTokenPriceAddr, srcTokenPriceOnDemand])

  const dstAddressesWithNative = useMemo(() => {
    if (!dstChainId || !userAddress) return []
    const addrs = [...dstAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [dstAddrs, dstChainId, userAddress])

  const { data: dstBalances, isLoading: dstBalancesLoading } = useEvmBalances({
    chainId: dstChainId || "",
    userAddress,
    tokenAddresses: dstAddressesWithNative,
  })

  const dstPriceAddresses = useMemo(() => {
    if (!dstBalances?.[dstChainId || ""] || !userAddress || !dstChainId) return []

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

  const { data: dstPrices, isLoading: dstPricesLoading } = useDexscreenerPrices({
    chainId: dstChainId || "",
    addresses: dstPriceAddresses,
    enabled: dstPriceAddresses.length > 0,
  })

  const dstTokenPriceAddr = useMemo(() => {
    if (!dstToken || !dstChainId) return undefined
    if (dstToken.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(dstChainId, zeroAddress) as Address | undefined
    }
    return dstToken
  }, [dstToken, dstChainId])

  const dstTokenPriceInCache = dstTokenPriceAddr && dstPrices?.[dstChainId || ""]?.[dstTokenPriceAddr.toLowerCase()]
  const { price: dstTokenPriceOnDemand, isLoading: dstTokenPriceOnDemandLoading } = useTokenPrice({
    chainId: dstChainId || "",
    tokenAddress: dstTokenPriceAddr,
    enabled: Boolean(dstToken && dstChainId && !dstTokenPriceInCache),
  })

  const dstPricesMerged = useMemo(() => {
    const merged = { ...dstPrices?.[dstChainId || ""] }
    if (dstTokenPriceAddr && dstTokenPriceOnDemand) {
      merged[dstTokenPriceAddr.toLowerCase()] = { usd: dstTokenPriceOnDemand }
    }
    return merged
  }, [dstPrices, dstChainId, dstTokenPriceAddr, dstTokenPriceOnDemand])

  // Fetch individual token balances for selected tokens (ensures balance is available even if not in list)
  const { data: srcTokenBalance, isLoading: srcTokenBalanceLoading } = useTokenBalance({
    chainId: srcChainId || "",
    userAddress,
    tokenAddress: srcToken,
  })

  const { data: dstTokenBalance, isLoading: dstTokenBalanceLoading } = useTokenBalance({
    chainId: dstChainId || "",
    userAddress,
    tokenAddress: dstToken,
  })

  const debouncedAmount = useDebounce(amount, 1000)
  // Create stable keys for debounce to avoid array reference churn
  // These keys include chainId to handle native tokens correctly (same token name, different chain = different address)
  const srcKey = useMemo(() => `${srcChainId || ""}|${(srcToken || "").toLowerCase()}`, [srcChainId, srcToken])
  const dstKey = useMemo(() => `${dstChainId || ""}|${(dstToken || "").toLowerCase()}`, [dstChainId, dstToken])
  const debouncedSrcKey = useDebounce(srcKey, 1000)
  const debouncedDstKey = useDebounce(dstKey, 1000)

  const { slippage, setPriceImpact } = useSlippage()
  const [txInProgress, setTxInProgress] = useState(false)
  const [destinationCalls, setDestinationCalls] = useState<DestinationCall[]>([])

  const { quotes, quoting, selectedQuoteIndex, setSelectedQuoteIndex, amountWei, refreshQuotes, abortQuotes } = useSwapQuotes({
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
  })

  const selectedTrade = quotes[selectedQuoteIndex]?.trade

  const quoteOut = useMemo(() => {
    const trade = selectedTrade
    if (!trade?.outputAmount) return undefined
    try {
      // Use library conversion to exact string
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
    srcToken,
    dstToken,
    srcChainId,
    dstChainId,
    srcPricesMerged,
    dstPricesMerged,
  })

  // Update price impact in context when it changes
  useEffect(() => {
    setPriceImpact(priceImpact)
  }, [priceImpact, setPriceImpact])

  // Preselect token on chain change: native or wrapped native if available
  useEffect(() => {
    if (!srcChainId) return
    const native = chains?.[srcChainId]?.data?.nativeCurrency?.symbol
    const force = srcChainId === "8453" ? "USDC" : undefined
    if (srcToken && srcTokensMap[srcToken.toLowerCase()]) return
    const pick = pickPreferredToken(srcTokensMap, force || native)
    if (pick) setSrcToken(pick as Address)
  }, [srcChainId, srcTokensMap, chains, srcToken])
  useEffect(() => {
    if (!dstChainId) return
    const native = chains?.[dstChainId]?.data?.nativeCurrency?.symbol
    const force = dstChainId === SupportedChainId.MOONBEAM ? "GLMR" : dstChainId === srcChainId ? "USDC" : undefined
    if (dstToken && dstTokensMap[dstToken.toLowerCase()]) return
    const pick = pickPreferredToken(dstTokensMap, force || native)
    if (pick) setDstToken(pick as Address)
  }, [dstChainId, dstTokensMap, chains, srcChainId, dstToken])

  const queryClient = useQueryClient()
  const [actions, setActions] = useState<PendingAction[]>([])
  const [sellModalOpen, setSellModalOpen] = useState(false)
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const [modalSellQuery, setModalSellQuery] = useState("")
  const [modalBuyQuery, setModalBuyQuery] = useState("")
  const lastAppliedActionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const pricedAction = actions.find((a) => {
      const meta = (a.config as any).meta || {}
      return (
        typeof meta.minDstAmountRaw === "string" &&
        typeof meta.minDstAmountDecimals === "number" &&
        typeof meta.minDstChainId === "string" &&
        typeof meta.minDstToken === "string"
      )
    })
    if (!pricedAction) {
      return
    }
    if (lastAppliedActionIdRef.current === pricedAction.id) {
      return
    }
    const meta = (pricedAction.config as any).meta || {}
    const minDstToken = meta.minDstToken as Address
    const minDstChainId = meta.minDstChainId as string
    const minDstAmountRaw = meta.minDstAmountRaw as string
    const minDstAmountDecimals = meta.minDstAmountDecimals as number
    const bufferBps = typeof meta.minDstAmountBufferBps === "number" ? meta.minDstAmountBufferBps : DEFAULT_BUFFER_BPS
    if (!minDstToken || !minDstChainId || !minDstAmountRaw || minDstAmountDecimals == null) {
      return
    }
    if (dstChainId !== minDstChainId) {
      setDstChainId(minDstChainId)
    }
    if (!dstToken || dstToken.toLowerCase() !== minDstToken.toLowerCase()) {
      setDstToken(minDstToken)
    }
    const srcPriceEntry =
      srcToken && srcChainId && srcPricesMerged
        ? srcPricesMerged[srcTokenPriceAddr?.toLowerCase() || ""] || srcPricesMerged[srcToken.toLowerCase()]
        : undefined
    const dstPriceEntry =
      minDstToken && dstChainId && dstPricesMerged
        ? dstPricesMerged[minDstToken.toLowerCase()] || (dstTokenPriceAddr ? dstPricesMerged[dstTokenPriceAddr.toLowerCase()] : undefined)
        : undefined
    const srcUsd = srcPriceEntry && typeof srcPriceEntry.usd === "number" ? srcPriceEntry.usd : undefined
    const dstUsd = dstPriceEntry && typeof dstPriceEntry.usd === "number" ? dstPriceEntry.usd : undefined
    if (!srcUsd || !dstUsd) {
      return
    }
    const base = Number(minDstAmountRaw)
    if (!isFinite(base) || base <= 0) {
      return
    }
    const divisor = Math.pow(10, minDstAmountDecimals)
    const minDstAmountHuman = base / divisor
    if (!isFinite(minDstAmountHuman) || minDstAmountHuman <= 0) {
      return
    }
    const requiredUsd = minDstAmountHuman * dstUsd
    if (!isFinite(requiredUsd) || requiredUsd <= 0) {
      return
    }
    const bufferFactor = 1 + bufferBps / 10000
    const srcAmountHuman = (requiredUsd / srcUsd) * bufferFactor
    if (!isFinite(srcAmountHuman) || srcAmountHuman <= 0) {
      return
    }
    const formatted = srcAmountHuman.toString()
    setAmount(formatted)
    lastAppliedActionIdRef.current = pricedAction.id
  }, [actions, dstChainId, dstToken, srcToken, srcChainId, srcPricesMerged, dstPricesMerged, srcTokenPriceAddr, dstTokenPriceAddr])

  const handleReset = useCallback(() => {
    setAmount("")
    setSrcToken(zeroAddress)
    setDstToken(zeroAddress)
    setSrcChainId(SupportedChainId.BASE)
    setDstChainId(SupportedChainId.MOONBEAM)
    setDestinationCalls([])
    setActions([])
    setTxInProgress(false)
    abortQuotes()
  }, [abortQuotes])

  const srcSymbol = srcToken && srcChainId ? lists?.[srcChainId]?.[srcToken.toLowerCase()]?.symbol || "Token" : "Token"
  const dstSymbol = quotes[selectedQuoteIndex]?.trade?.outputAmount?.currency?.symbol || "Token"

  const setDestinationInfo = useCallback(
    (chainId: string, address: string, amount?: string) => {
      setDstToken(address as any)
      setDstChainId(chainId)
      // do not set amount
      if (!amount) return

      const priceIn = getTokenPrice(chainId, address as any, srcPricesMerged)
      const priceOut = getTokenPrice(chainId, address as any, dstPricesMerged)
      const decimalsIn = lists?.[srcChainId ?? ""]?.[srcToken?.toLowerCase() ?? ""]?.decimals
      const decimalsOut = lists?.[dstChainId ?? ""]?.[dstToken?.toLowerCase() ?? ""]?.decimals
      const amountIn = reverseQuote(decimalsIn, decimalsOut, amount, priceIn ?? 1, priceOut ?? 1)
      setAmount(amountIn)
    },
    [srcPricesMerged, dstPricesMerged, dstToken]
  )

  return (
    <div>
      <div className="relative">
        <TokenInputSection
          amount={amount}
          onAmountChange={setAmount}
          srcToken={srcToken}
          srcChainId={srcChainId}
          srcTokenBalance={srcTokenBalance}
          srcBalances={srcBalances}
          srcPricesMerged={srcPricesMerged}
          lists={lists}
          onTokenClick={() => setSellModalOpen(true)}
          onReset={handleReset}
          onPercentageClick={(p) => {
            const bal = srcTokenBalance?.value || (srcToken && srcChainId ? srcBalances?.[srcChainId]?.[srcToken.toLowerCase()]?.value : undefined)
            const n = bal ? Number(bal) : 0
            setAmount(n > 0 ? ((n * p) / 100).toString() : "")
          }}
        />
        <div className="flex justify-center -my-4 relative z-10">
          <button
            type="button"
            className="btn rounded-2xl bg-base-100 border-2 border-base-100 shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => {
              const sc = srcChainId
              const st = srcToken
              setSrcChainId(dstChainId)
              setSrcToken(dstToken)
              setDstChainId(sc)
              setDstToken(st)
            }}
          >
            <span style={{ fontSize: "30px" }}>↕</span>
          </button>
        </div>
        <TokenOutputSection
          quoteOut={quoteOut}
          dstToken={dstToken}
          dstChainId={dstChainId}
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
          srcChainId={srcChainId}
          dstChainId={dstChainId}
          dstToken={dstToken}
          dstPricesMerged={dstPricesMerged}
          quoting={quoting}
          isBridge={srcChainId !== dstChainId}
        />
      </div>
      {/* Selection Modals */}
      <TokenSelectorModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        chainId={srcChainId}
        onChainChange={(cid: string) => {
          setSrcChainId(cid)
          setSrcToken(undefined)
        }}
        tokenValue={srcToken}
        onTokenChange={(addr: Address) => {
          setSrcToken(addr)
        }}
        query={modalSellQuery}
        onQueryChange={setModalSellQuery}
        userAddress={userAddress}
      />
      <TokenSelectorModal
        open={buyModalOpen}
        onClose={() => setBuyModalOpen(false)}
        chainId={dstChainId}
        onChainChange={(cid: string) => {
          setDstChainId(cid)
          setDstToken(undefined)
        }}
        tokenValue={dstToken}
        onTokenChange={(addr: Address) => {
          if (srcChainId === dstChainId && srcToken && addr.toLowerCase() === srcToken.toLowerCase()) return
          setDstToken(addr)
        }}
        query={modalBuyQuery}
        onQueryChange={setModalBuyQuery}
        userAddress={userAddress}
        excludeAddresses={srcChainId === dstChainId && srcToken ? [srcToken] : []}
      />
      <ActionsPanel
        dstChainId={dstChainId}
        dstToken={dstToken}
        userAddress={userAddress}
        currentChainId={currentChainId}
        isEncoding={isEncoding}
        setIsEncoding={setIsEncoding}
        destinationCalls={destinationCalls}
        setDestinationCalls={setDestinationCalls}
        actions={actions}
        setActions={setActions}
        onRefreshQuotes={refreshQuotes}
        tokenLists={lists}
        setDestinationInfo={setDestinationInfo}
      />
      {quotes.length > 0 && selectedTrade && (
        <div className="mt-4">
          <ExecuteButton
            trade={selectedTrade}
            srcChainId={srcChainId}
            dstChainId={dstChainId}
            userAddress={userAddress}
            srcToken={srcToken}
            amountWei={amountWei}
            actions={actions}
            destinationCalls={destinationCalls}
            chains={chains}
            onDone={(hashes) => {
              // Invalidate all balance queries for src/dst chains and tokens
              if (srcChainId && userAddress) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", srcChainId, userAddress],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", srcChainId, userAddress],
                })
              }
              if (dstChainId && userAddress) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", dstChainId, userAddress],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", dstChainId, userAddress],
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
