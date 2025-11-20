import { useMemo, useState, useEffect } from "react"
import { DestinationActionConfig } from "../lib/types/destinationAction"
import { Hex } from "viem"
import { getAllActions } from "../lib/actions/registry"
import { isMarketsLoading, isMarketsReady, subscribeToCacheChanges } from "../lib/moonwell/marketCache"
import type { RawCurrency, RawCurrencyAmount } from "../types/currency"
import { LendingSubPanel } from "./LendingSubPanel"
import { OlderfallPanel } from "./actions/nft/olderfall/OlderfallPanel"
import { DepositPanel } from "./actions/lending/deposit/DepositPanel"
import { GenericActionsPanel } from "./actions/generic/GenericActionPanel"

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
  const [marketsReady, setMarketsReady] = useState(isMarketsReady())
  const [marketsLoading, setMarketsLoading] = useState(isMarketsLoading())

  const dstToken = useMemo(() => dstCurrency?.address as string | undefined, [dstCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId as string | undefined, [dstCurrency])

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

  const lendingActions = useMemo(() => allActions.filter((a) => a.actionType === "lending"), [allActions])

  const hasLending = lendingActions.length > 0
  const showLendingPanel = hasLending
  const showOlderfallPanel = Boolean(onAdd)
  const showNonLendingPanel = Boolean(onAdd)

  if (marketsLoading && !marketsReady) {
    return (
      <div className="alert alert-info">
        <span className="loading loading-spinner loading-sm"></span>
        <span>Loading ...</span>
      </div>
    )
  }

  // If we can't add anything and there are no lending actions, show info
  if (!showLendingPanel && !showOlderfallPanel && !showNonLendingPanel) {
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
      <DepositPanel
        userAddress={userAddress}
        chainId={dstChainId}
        onAdd={(config, selector, args, value) => {
          onAdd?.(config, selector, args, value)
        }}
        setDestinationInfo={setDestinationInfo}
      />

      <LendingSubPanel
        dstToken={dstToken}
        userAddress={userAddress}
        chainId={dstChainId}
        onAdd={(config, selector, args, value) => {
          onAdd?.(config, selector, args, value)
        }}
      />

      {/* Olderfall is fully self-contained */}
      <OlderfallPanel
        dstToken={dstToken}
        dstChainId={dstChainId} //
        userAddress={userAddress}
        tokenLists={tokenLists}
        onAdd={onAdd}
      />

      {/* Non-lending generic actions are now fully self-contained */}
      <GenericActionsPanel
        dstToken={dstToken} //
        dstChainId={dstChainId}
        userAddress={userAddress}
        onAdd={onAdd}
      />
    </div>
  )
}
