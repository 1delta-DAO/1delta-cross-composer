import { useState, useEffect, useMemo } from "react"
import type { Hex, Address } from "viem"
import type { DestinationActionConfig } from "../lib/types/destinationAction"
import {
    getCachedMarkets,
    isMarketsReady,
    isMarketsLoading,
    subscribeToCacheChanges,
    type MoonwellMarket,
} from "../lib/moonwell/marketCache"
import { getActionsForMarket } from "../lib/actions/lending/moonwell/config"
import { LendingActionModal } from "./LendingActionModal"
import { MarketTokenCard } from "./MarketTokenCard"
import { useTokenBalance } from "../hooks/balances/useTokenBalance"
import { SupportedChainId } from "../sdk/types"

function MarketTokenCardWithBalance({
    market,
    depositAction,
    withdrawAction,
    userAddress,
    chainId,
    dstToken,
    onActionClick,
}: {
    market: MoonwellMarket
    depositAction: DestinationActionConfig | undefined
    withdrawAction: DestinationActionConfig | undefined
    userAddress?: string
    chainId?: string
    dstToken?: string
    onActionClick: (config: DestinationActionConfig, selector: Hex) => void
}) {
    const { data: tokenBalance } = useTokenBalance({
        chainId: chainId || SupportedChainId.MOONBEAM,
        userAddress: userAddress as Address | undefined,
        tokenAddress: market.underlying,
    })

    const isDstToken = useMemo(() => {
        if (!dstToken || !market.underlying) return false
        return market.underlying.toLowerCase() === dstToken.toLowerCase()
    }, [dstToken, market.underlying])

    const shouldShowDeposit = useMemo(() => {
        if (isDstToken) return true
        if (!tokenBalance?.raw) return false
        try {
            return BigInt(tokenBalance.raw) > 0n
        } catch {
            return false
        }
    }, [isDstToken, tokenBalance])

    if (!shouldShowDeposit && !withdrawAction) {
        return null
    }

    return (
        <MarketTokenCard
            market={market}
            depositAction={shouldShowDeposit ? depositAction : undefined}
            withdrawAction={withdrawAction}
            onActionClick={onActionClick}
        />
    )
}

type LendingSubPanelProps = {
    onAdd?: (config: DestinationActionConfig, functionSelector: Hex, args: any[], value?: string) => void
    dstToken?: string
    userAddress?: string
    chainId?: string
}

export function LendingSubPanel({ onAdd, dstToken, userAddress, chainId }: LendingSubPanelProps) {
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

    const depositMarkets = useMemo(() => {
        return markets.filter((m) => m.isListed)
    }, [markets])

    // Right column: Markets where borrow is not paused (for borrow/repay)
    const borrowMarkets = useMemo(() => {
        return markets.filter((m) => m.isListed && !m.borrowPaused)
    }, [markets])

    const getDepositActions = (market: (typeof markets)[0]) => {
        const allActions = getActionsForMarket(market, undefined)
        const depositActions = allActions.filter((a) => a.name.startsWith("Deposit"))
        const withdrawActions = allActions.filter((a) => a.name.startsWith("Withdraw"))

        return [...depositActions, ...withdrawActions]
    }

    const getBorrowActions = (market: (typeof markets)[0]) => {
        const actions = getActionsForMarket(market, dstToken)
        return actions.filter((a) => a.name.startsWith("Borrow") || a.name.startsWith("Repay"))
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
                        <div className="font-medium">Lending Actions</div>
                        <button className="btn btn-sm btn-ghost">{isExpanded ? "▼" : "▶"}</button>
                    </div>

                    {isExpanded && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[600px]">
                            {/* Left Column - Deposit/Withdraw */}
                            <div className="space-y-2">
                                <div className="text-sm font-semibold mb-2 opacity-70">Deposit / Withdraw</div>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {depositMarkets.length === 0 ? (
                                        <div className="text-sm opacity-50 text-center py-4">No markets available</div>
                                    ) : (
                                        depositMarkets
                                            .map((market) => {
                                                const actions = getDepositActions(market)
                                                const depositAction = actions.find((a) => a.name.startsWith("Deposit"))
                                                const withdrawAction = actions.find((a) => a.name.startsWith("Withdraw"))

                                                if (!depositAction && !withdrawAction) return null

                                                return (
                                                    <MarketTokenCardWithBalance
                                                        key={market.mToken}
                                                        market={market}
                                                        depositAction={depositAction}
                                                        withdrawAction={withdrawAction}
                                                        userAddress={userAddress}
                                                        chainId={chainId}
                                                        dstToken={dstToken}
                                                        onActionClick={handleActionClick}
                                                    />
                                                )
                                            })
                                            .filter(Boolean)
                                    )}
                                </div>
                            </div>

                            {/* Right Column - Borrow/Repay */}
                            <div className="space-y-2">
                                <div className="text-sm font-semibold mb-2 opacity-70">Borrow / Repay</div>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {borrowMarkets.length === 0 ? (
                                        <div className="text-sm opacity-50 text-center py-4">No borrowable markets available</div>
                                    ) : (
                                        borrowMarkets.map((market) => {
                                            const actions = getBorrowActions(market)
                                            const borrowAction = actions.find((a) => a.name.startsWith("Borrow"))
                                            const repayAction = actions.find((a) => a.name.startsWith("Repay"))

                                            return (
                                                <div
                                                    key={market.mToken}
                                                    className="card bg-base-100 border border-base-300 hover:border-primary/50 transition-colors group"
                                                >
                                                    <div className="card-body p-3">
                                                        <div className="font-medium text-sm">{market.symbol || "Unknown"}</div>
                                                        <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {borrowAction && borrowAction.defaultFunctionSelector && (
                                                                <button
                                                                    className="btn btn-xs btn-primary flex-1"
                                                                    onClick={() =>
                                                                        handleActionClick(borrowAction, borrowAction.defaultFunctionSelector!)
                                                                    }
                                                                >
                                                                    Borrow
                                                                </button>
                                                            )}
                                                            {repayAction && repayAction.defaultFunctionSelector && (
                                                                <button
                                                                    className="btn btn-xs btn-outline flex-1"
                                                                    onClick={() =>
                                                                        handleActionClick(repayAction, repayAction.defaultFunctionSelector!)
                                                                    }
                                                                >
                                                                    Repay
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <LendingActionModal
                open={modalAction !== null}
                onClose={() => setModalAction(null)}
                actionConfig={modalAction?.config || null}
                selector={modalAction?.selector || null}
                userAddress={userAddress as any}
                chainId={chainId}
                onConfirm={handleModalConfirm}
            />
        </>
    )
}
