import { useMemo, useState, useEffect } from "react"
import { DestinationActionConfig, DestinationActionType } from "../lib/types/destinationAction"
import { Hex } from "viem"
import { getAllActions, getActionsByGroup } from "../lib/actions/registry"
import { isMarketsLoading, isMarketsReady, subscribeToCacheChanges } from "../lib/moonwell/marketCache"
import { SupportedChainId } from "../sdk/types"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"
import { getTokenFromCache } from "../lib/data/tokenListsCache"
import type { RawCurrency, RawCurrencyAmount } from "../types/currency"
import { LendingSubPanel } from "./LendingSubPanel"
import { LendingActionModal } from "./LendingActionModal"
import { useOlderfallListings } from "../hooks/useOlderfallListings"

interface DestinationActionSelectorProps {
  onAdd?: (config: DestinationActionConfig, functionSelector: Hex, args?: any[], value?: string) => void
  dstCurrency?: RawCurrency
  userAddress?: string
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: (amount: RawCurrencyAmount | undefined) => void
}

export default function DestinationActionSelector({
  onAdd,
  dstCurrency,
  userAddress,
  tokenLists,
  setDestinationInfo,
}: DestinationActionSelectorProps) {
  const [selectedActionType, setSelectedActionType] = useState<DestinationActionType | "">("")
  const [selectedActionKey, setSelectedActionKey] = useState<string>("")
  const [marketsReady, setMarketsReady] = useState(isMarketsReady())
  const [marketsLoading, setMarketsLoading] = useState(isMarketsLoading())
  const [modalAction, setModalAction] = useState<{ config: DestinationActionConfig; selector: Hex } | null>(null)
  const [selectedOlderfallOrderId, setSelectedOlderfallOrderId] = useState<string>("")

  const dstToken = useMemo(() => dstCurrency?.address as string | undefined, [dstCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId, [dstCurrency])

  // Subscribe to market cache changes
  useEffect(() => {
    setMarketsReady(isMarketsReady())
    setMarketsLoading(isMarketsLoading())

    const unsubscribe = subscribeToCacheChanges(() => {
      setMarketsReady(isMarketsReady())
      setMarketsLoading(isMarketsLoading())
    })

    return unsubscribe
  }, [])

  const allActions = useMemo(() => getAllActions({ dstToken, dstChainId }), [dstToken, dstChainId, marketsReady])

  const olderfallActions = useMemo(() => allActions.filter((a) => a.group === "olderfall_nft"), [allActions])
  const lendingActions = useMemo(() => allActions.filter((a) => a.actionType === "lending"), [allActions])
  const nonLendingActions = useMemo(() => {
    return allActions.filter((a) => a.actionType !== "lending" && a.group !== "olderfall_nft")
  }, [allActions])

  const hasOlderfall = olderfallActions.length > 0
  const hasLending = lendingActions.length > 0

  const { listings: olderfallListings, loading: olderfallLoading } = useOlderfallListings(hasOlderfall, dstChainId)

  const actionsByType = useMemo(() => {
    if (!selectedActionType) {
      // Deduplicate by address-name combination
      const seen = new Set<string>()
      return nonLendingActions.filter((a) => {
        const key = `${a.address.toLowerCase()}-${a.name}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    return getActionsByGroup(selectedActionType, { dstToken, dstChainId }).filter((a) => a.actionType !== "lending" && a.group !== "olderfall_nft")
  }, [nonLendingActions, selectedActionType, dstToken, dstChainId])

  const handleSelectAction = (val: string) => {
    setSelectedActionKey(val)
  }

  if (marketsLoading && !marketsReady) {
    return (
      <div className="alert alert-info">
        <span className="loading loading-spinner loading-sm"></span>
        <span>Loading ...</span>
      </div>
    )
  }

  const showLendingPanel = hasLending
  const showOlderfallSection = hasOlderfall && Boolean(onAdd)

  if (nonLendingActions.length === 0 && !showLendingPanel && !showOlderfallSection) {
    return (
      <div className="alert alert-info">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>No destination actions configured yet. Actions can be added via configuration files.</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* <DepositPanel
        userAddress={userAddress}
        chainId={dstChainId}
        onAdd={(config, selector, args, value) => {
          if (onAdd) {
            onAdd(config, selector, args, value)
          }
        }}
        setDestinationInfo={setDestinationInfo}
      /> */}
      {showLendingPanel && (
        <LendingSubPanel
          dstToken={dstToken}
          userAddress={userAddress}
          chainId={dstChainId}
          onAdd={(config, selector, args, value) => {
            if (onAdd) {
              onAdd(config, selector, args, value)
            }
          }}
        />
      )}
      {showOlderfallSection && (
        <div className="space-y-2">
          <div className="font-semibold text-sm">Olderfall NFTs</div>
          {olderfallLoading ? (
            <div className="flex items-center gap-2 text-xs opacity-70">
              <span className="loading loading-spinner loading-xs" />
              <span>Loading listings from Sequence…</span>
            </div>
          ) : olderfallListings.length > 0 ? (
            <div className="space-y-2">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {olderfallListings.map((l) => {
                  const isSelected = selectedOlderfallOrderId === l.orderId
                  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM
                  const tokenMeta = tokenLists && tokenChainId && l.currency ? tokenLists[tokenChainId]?.[l.currency.toLowerCase()] : undefined
                  const decimals = typeof tokenMeta?.decimals === "number" ? tokenMeta.decimals : l.priceDecimals
                  const symbol = tokenMeta?.symbol || "TOKEN"
                  let priceLabel = ""
                  try {
                    const base = BigInt(l.pricePerToken)
                    const d = BigInt(decimals >= 0 ? decimals : 0)
                    const denom = 10n ** d
                    const whole = base / denom
                    const frac = base % denom
                    let fracStr = decimals > 0 ? frac.toString().padStart(Number(d), "0") : ""
                    if (fracStr) {
                      fracStr = fracStr.replace(/0+$/, "")
                    }
                    const human = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
                    priceLabel = `${human} ${symbol}`
                  } catch {
                    priceLabel = `${l.pricePerToken} ${symbol}`
                  }
                  const title = l.name || `Armor #${l.tokenId}`
                  return (
                    <button
                      key={l.orderId}
                      type="button"
                      className={`w-full flex items-center gap-3 p-2 rounded border ${
                        isSelected ? "border-primary bg-primary/10" : "border-base-300"
                      }`}
                      onClick={() => setSelectedOlderfallOrderId(l.orderId)}
                    >
                      {l.image && (
                        <div className="w-10 h-10 rounded overflow-hidden bg-base-300 shrink-0">
                          <img src={l.image} alt={title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex flex-col items-start text-left">
                        <div className="text-sm font-medium truncate max-w-[200px]">{title}</div>
                        <div className="text-xs opacity-70">#{l.tokenId}</div>
                        <div className="text-xs font-semibold">{priceLabel}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <button
                className="btn btn-primary"
                disabled={!selectedOlderfallOrderId || !userAddress}
                onClick={() => {
                  if (!selectedOlderfallOrderId || !userAddress) {
                    return
                  }
                  const cfg = allActions.find((a) => a.group === "olderfall_nft")
                  const listing = olderfallListings.find((l) => l.orderId === selectedOlderfallOrderId)
                  if (!cfg || !listing) {
                    return
                  }
                  const selector = (cfg.defaultFunctionSelector as Hex) || (cfg.functionSelectors[0] as Hex) || ("0x" as Hex)
                  const args: any[] = [
                    BigInt(selectedOlderfallOrderId),
                    1n,
                    userAddress,
                    [],
                    [],
                    BigInt(listing.tokenId),
                    listing.currency,
                    listing.pricePerToken,
                    listing.tokenContract,
                  ]
                  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM
                  const tokenMeta =
                    tokenLists && tokenChainId && listing.currency ? tokenLists[tokenChainId]?.[listing.currency.toLowerCase()] : undefined
                  const cachedToken = getTokenFromCache(tokenChainId, listing.currency)
                  const currency: { chainId: string; address: string; symbol?: string; decimals: number } = cachedToken
                    ? {
                        chainId: cachedToken.chainId,
                        address: cachedToken.address,
                        symbol: cachedToken.symbol,
                        decimals: cachedToken.decimals,
                      }
                    : tokenMeta
                      ? {
                          chainId: tokenChainId,
                          address: listing.currency,
                          symbol: tokenMeta.symbol,
                          decimals: tokenMeta.decimals ?? listing.priceDecimals,
                        }
                      : {
                          chainId: tokenChainId,
                          address: listing.currency,
                          decimals: listing.priceDecimals,
                        }
                  const minDstAmount = CurrencyHandler.fromRawAmount(currency, listing.pricePerToken)
                  const cfgWithMeta: DestinationActionConfig = {
                    ...cfg,
                    meta: {
                      ...(cfg.meta || {}),
                      sequenceCurrency: listing.currency,
                      sequencePricePerToken: listing.pricePerToken,
                      sequenceTokenId: listing.tokenId,
                      sequencePriceDecimals: listing.priceDecimals,
                      minDstAmount,
                      minDstAmountBufferBps: 30,
                    } as any,
                  }
                  if (onAdd) {
                    onAdd(cfgWithMeta, selector, args, "0")
                  }
                  setSelectedOlderfallOrderId("")
                }}
              >
                Add
              </button>
            </div>
          ) : (
            <div className="text-xs opacity-70">No Olderfall listings found or Sequence API not configured.</div>
          )}
        </div>
      )}
      {nonLendingActions.length > 0 && (
        <div className="form-control">
          <div className="flex items-center gap-2">
            <select
              value={selectedActionType}
              onChange={(e) => {
                setSelectedActionType(e.target.value as DestinationActionType | "")
                setSelectedActionKey("")
              }}
              className="select select-bordered flex-1"
            >
              <option value="">All Types</option>
              <option value="game_token">Game Token</option>
              <option value="buy_ticket">Buy Ticket</option>
              <option value="custom">Custom</option>
            </select>
            <select value={selectedActionKey} onChange={(e) => handleSelectAction(e.target.value)} className="select select-bordered flex-1">
              <option value="">Choose an action...</option>
              {actionsByType.flatMap((action) => {
                const selectors = action.defaultFunctionSelector
                  ? [action.defaultFunctionSelector, ...action.functionSelectors]
                  : action.functionSelectors
                const uniq = Array.from(new Set(selectors.map((s) => s.toLowerCase())))
                return uniq.map((selector) => {
                  const key = `${action.address.toLowerCase()}|${selector}`
                  return (
                    <option key={key} value={key}>
                      {action.name}
                    </option>
                  )
                })
              })}
            </select>
            <button
              className="btn btn-primary"
              disabled={!selectedActionKey}
              onClick={() => {
                if (!selectedActionKey) return
                const [addr, selector] = selectedActionKey.split("|")
                const action = actionsByType.find((a) => a.address.toLowerCase() === addr)
                if (!action || !selector) return
                // Open modal instead of adding directly
                setModalAction({ config: action, selector: selector as Hex })
                setSelectedActionKey("") // Reset selection
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
      {modalAction && (
        <LendingActionModal
          open={modalAction !== null}
          onClose={() => setModalAction(null)}
          actionConfig={modalAction.config}
          selector={modalAction.selector}
          userAddress={userAddress as any}
          chainId={dstChainId}
          onConfirm={(config, selector, args, value) => {
            if (onAdd) {
              onAdd(config, selector, args, value)
            }
            setModalAction(null)
          }}
        />
      )}
    </div>
  )
}
