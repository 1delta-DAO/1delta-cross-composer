import { useState, useEffect, useMemo } from "react"
import type { Hex, Address } from "viem"
import type { DestinationActionConfig } from "../../../../lib/types/destinationAction"
import type { RawCurrencyAmount } from "../../../../types/currency"
import {
  getCachedMarkets,
  isMarketsReady,
  isMarketsLoading,
  subscribeToCacheChanges,
  type MoonwellMarket,
} from "../../../../lib/moonwell/marketCache"
import { getActionsForMarket } from "../../../../lib/actions/lending/moonwell/config"
import { DepositActionModal } from "./DepositModal"
import { DepositCard } from "./DepositCard"
function DepositCardWithBalance({
  market,
  depositAction,
  onActionClick,
}: {
  market: MoonwellMarket
  depositAction: DestinationActionConfig | undefined

  onActionClick: (config: DestinationActionConfig, selector: Hex) => void
}) {
  const shouldShowDeposit = true

  // Nothing to do if no deposit action or we shouldn't show this row
  if (!shouldShowDeposit || !depositAction) {
    return null
  }

  return <DepositCard market={market} depositAction={depositAction} onActionClick={onActionClick} />
}

type DepositPanelProps = {
  onAdd?: (config: DestinationActionConfig, functionSelector: Hex, args: any[], value?: string) => void
  userAddress?: string
  chainId?: string
  setDestinationInfo?: (amount: RawCurrencyAmount | undefined) => void
}

export function DepositPanel({ onAdd, userAddress, chainId, setDestinationInfo }: DepositPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [marketsReady, setMarketsReady] = useState(isMarketsReady())
  const [marketsLoading, setMarketsLoading] = useState(isMarketsLoading())
  const [modalAction, setModalAction] = useState<{ config: DestinationActionConfig; selector: Hex } | null>(null)

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

  const markets = useMemo(() => getCachedMarkets() || [], [marketsReady])

  // Only listed markets can be used for deposits
  const depositMarkets = useMemo(() => {
    return markets.filter((m) => m.isListed)
  }, [markets])

  const getDepositAction = (market: (typeof markets)[0]) => {
    const allActions = getActionsForMarket(market, undefined)
    return allActions.find((a) => a.name.startsWith("Deposit"))
  }

  const handleActionClick = (config: DestinationActionConfig, selector: Hex) => {
    if (onAdd) {
      setModalAction({ config, selector })
    }
  }

  const handleModalConfirm = (config: DestinationActionConfig, selector: Hex, args: any[], value?: string) => {
    if (onAdd) {
      onAdd(config, selector, args, value)
    }
    setModalAction(null)
  }

  // Loading / empty states
  if (marketsLoading && !marketsReady) {
    return (
      <div className="alert alert-info">
        <span className="loading loading-spinner loading-sm"></span>
        <span>Loading markets...</span>
      </div>
    )
  }

  if (!marketsReady || markets.length === 0) {
    return (
      <div className="alert alert-warning">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>Moonwell markets are not available yet. Please wait for markets to load.</span>
      </div>
    )
  }

  return (
    <>
      <div className="card bg-base-200 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="font-medium">Lending Deposits</div>
            <button className="btn btn-sm btn-ghost">{isExpanded ? "▼" : "▶"}</button>
          </div>

          {isExpanded && (
            <div className="mt-4 max-w-[600px]">
              <div className="text-sm font-semibold mb-2 opacity-70">Deposit</div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {depositMarkets.length === 0 ? (
                  <div className="text-sm opacity-50 text-center py-4">No markets available</div>
                ) : (
                  depositMarkets
                    .map((market) => {
                      const depositAction = getDepositAction(market)
                      if (!depositAction) return null

                      return (
                        <DepositCardWithBalance key={market.mTokenCurrency.address} market={market} depositAction={depositAction} onActionClick={handleActionClick} />
                      )
                    })
                    .filter(Boolean)
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <DepositActionModal
        open={modalAction !== null}
        onClose={() => setModalAction(null)}
        actionConfig={modalAction?.config || null}
        selector={modalAction?.selector || null}
        userAddress={userAddress as any}
        chainId={chainId}
        onConfirm={handleModalConfirm}
        setDestinationInfo={setDestinationInfo}
      />
    </>
  )
}
