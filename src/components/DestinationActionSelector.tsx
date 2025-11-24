import { useMemo, useState, useEffect } from "react"
import { isMarketsLoading, isMarketsReady, subscribeToCacheChanges } from "../lib/moonwell/marketCache"
import type { RawCurrency } from "../types/currency"
import { LendingSubPanel } from "./LendingSubPanel"
import { OlderfallPanel } from "./actions/nft/olderfall/OlderfallPanel"
import { DepositPanel } from "./actions/lending/deposit/DepositPanel"
import { GenericActionsPanel } from "./actions/generic/GenericActionPanel"
import { DestinationActionHandler } from "./actions/shared/types"

interface DestinationActionSelectorProps {
  dstCurrency?: RawCurrency
  userAddress?: string
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: DestinationActionHandler
}

export default function DestinationActionSelector({ dstCurrency, userAddress, tokenLists, setDestinationInfo }: DestinationActionSelectorProps) {
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

  if (marketsLoading && !marketsReady) {
    return (
      <div className="alert alert-info">
        <span className="loading loading-spinner loading-sm"></span>
        <span>Loading ...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DepositPanel
        userAddress={userAddress}
        chainId={dstChainId}
        setDestinationInfo={setDestinationInfo} //
      />

      <LendingSubPanel
        dstToken={dstToken}
        userAddress={userAddress}
        chainId={dstChainId}
        setDestinationInfo={setDestinationInfo} //
      />

      {/* Olderfall is fully self-contained */}
      <OlderfallPanel //
        userAddress={userAddress}
        tokenLists={tokenLists}
        setDestinationInfo={setDestinationInfo}
      />

      {/* Non-lending generic actions are now fully self-contained */}
      <GenericActionsPanel
        dstToken={dstToken} //
        dstChainId={dstChainId}
        userAddress={userAddress}
        setDestinationInfo={setDestinationInfo}
      />
    </div>
  )
}
