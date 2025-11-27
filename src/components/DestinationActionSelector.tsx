import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { isMarketsLoading, isMarketsReady, subscribeToCacheChanges } from '../lib/moonwell/marketCache'
import type { RawCurrency, RawCurrencyAmount } from '../types/currency'
import { ActionIconGrid } from './actions/shared/ActionIconGrid'
import { SelectedActionHeader } from './actions/shared/SelectedActionHeader'
import {
  getRegisteredActions,
  getActionsByCategory,
  type ActionType,
  type ActionCategory,
  type ActionLoaderContext,
  type ActionReadinessContext,
} from './actions/shared/actionDefinitions'
import { DestinationActionHandler } from './actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'

interface DestinationActionSelectorProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: DestinationActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  resetKey?: number
  onSrcCurrencyChange?: (currency: RawCurrency) => void
  destinationInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
  isRequoting?: boolean
}

export default function DestinationActionSelector({
  srcCurrency,
  dstCurrency,
  tokenLists,
  setDestinationInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  resetKey,
  onSrcCurrencyChange,
  destinationInfo,
  isRequoting,
}: DestinationActionSelectorProps) {
  const [marketsReady, setMarketsReady] = useState(isMarketsReady())
  const [marketsLoading, setMarketsLoading] = useState(isMarketsLoading())
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory>('all')
  const [isExpanded, setIsExpanded] = useState(true)
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const [actionData, setActionData] = useState<Record<string, any>>({})
  const [actionDataLoading, setActionDataLoading] = useState<Record<string, boolean>>({})
  const [panelResetKey, setPanelResetKey] = useState(0)

  const dstToken = useMemo(() => dstCurrency?.address as string | undefined, [dstCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId as string | undefined, [dstCurrency])

  const tokenListsMeta = useMemo(() => {
    if (!tokenLists) return undefined
    const meta: Record<string, Record<string, { symbol?: string; decimals: number; address: string; chainId: string }>> = {}
    for (const chainId in tokenLists) {
      meta[chainId] = {}
      for (const address in tokenLists[chainId]) {
        const token = tokenLists[chainId][address]
        meta[chainId][address.toLowerCase()] = {
          symbol: token.symbol,
          decimals: token.decimals ?? 18,
          address: address,
          chainId: chainId,
        }
      }
    }
    return meta
  }, [tokenLists])

  // Get available actions based on srcCurrency
  const availableActions = useMemo(() => {
    return getRegisteredActions().filter((action) => {
      if (action.requiresSrcCurrency) {
        return Boolean(srcCurrency)
      }
      return true
    })
  }, [srcCurrency])

  // Filter actions by selected category
  const filteredActions = useMemo(() => {
    return getActionsByCategory(selectedCategory, srcCurrency)
  }, [selectedCategory, srcCurrency])

  const isActionReady = useMemo(() => {
    const ready: Record<string, boolean> = {}
    const readinessContext: ActionReadinessContext = {
      marketsReady,
      marketsLoading,
      srcCurrency,
    }

    availableActions.forEach((action) => {
      const isLoading = actionDataLoading[action.id] === true
      const hasData = actionData[action.id] !== null && actionData[action.id] !== undefined

      if (action.dataLoader) {
        ready[action.id] = !isLoading && hasData
      } else if (action.isReady) {
        ready[action.id] = action.isReady(readinessContext)
      } else {
        ready[action.id] = !action.requiresMarkets || marketsReady
      }
    })

    return ready
  }, [availableActions, marketsReady, marketsLoading, srcCurrency, actionDataLoading, actionData])

  const isActionLoading = useMemo(() => {
    const loading: Record<string, boolean> = {}
    availableActions.forEach((action) => {
      const isDataLoading = actionDataLoading[action.id] === true
      const isMarketsLoading = action.requiresMarkets && marketsLoading && !isActionReady[action.id]
      loading[action.id] = isDataLoading || (isMarketsLoading ?? false)
    })
    return loading
  }, [availableActions, actionDataLoading, marketsLoading, isActionReady])

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

  // Load data for actions with dataLoaders
  useEffect(() => {
    const loadActionData = async () => {
      const loaderContext: ActionLoaderContext = {
        srcCurrency,
        dstCurrency,
        tokenLists: tokenListsMeta,
        chainId: dstChainId,
      }

      const loadPromises = availableActions.map(async (action) => {
        if (!action.dataLoader) return

        try {
          setActionDataLoading((prev) => ({ ...prev, [action.id]: true }))
          const data = await action.dataLoader!(loaderContext)
          setActionData((prev) => ({ ...prev, [action.id]: data }))
        } catch (error) {
          console.error(`Failed to load data for action ${action.id}:`, error)
          setActionData((prev) => ({ ...prev, [action.id]: null }))
        } finally {
          setActionDataLoading((prev) => ({ ...prev, [action.id]: false }))
        }
      })

      await Promise.all(loadPromises)
    }

    loadActionData()
  }, [availableActions, srcCurrency, dstCurrency, tokenListsMeta, dstChainId])

  const prevSelectedActionRef = useRef<ActionType | null>(null)

  useEffect(() => {
    const prevAction = prevSelectedActionRef.current
    const currentAction = selectedAction

    if (prevAction !== null && currentAction !== null && prevAction !== currentAction) {
      setDestinationInfo?.(undefined, undefined, [])
    }

    prevSelectedActionRef.current = currentAction
  }, [selectedAction, setDestinationInfo])

  const handleReset = () => {
    setSelectedAction(null)
    setSelectedCategory('all')
    setIsExpanded(true)
    setIsPanelExpanded(true)

    setDestinationInfo?.(undefined, undefined, [])

    setPanelResetKey((prev) => prev + 1)
  }

  const handleActionSelect = (actionId: ActionType) => {
    const actionDef = availableActions.find((a) => a.id === actionId)
    if (!actionDef) return

    const isLoading = actionDataLoading[actionId] === true
    const hasData = actionData[actionId] !== null && actionData[actionId] !== undefined

    if (actionDef.dataLoader && (isLoading || !hasData)) {
      return
    }

    setSelectedAction(actionId)
    setIsExpanded(false)
    setIsPanelExpanded(true)
  }

  const handlePanelToggle = () => {
    setIsPanelExpanded(!isPanelExpanded)
  }

  const handleCloseAction = () => {
    setSelectedAction(null)
    setIsPanelExpanded(true)
    setDestinationInfo?.(undefined, undefined, [])
    setPanelResetKey((prev) => prev + 1)
  }

  const wrappedSetDestinationInfo = useCallback<DestinationActionHandler>(
    (currencyAmount, receiverAddress, destinationCalls, actionLabel) => {
      setDestinationInfo?.(currencyAmount, receiverAddress, destinationCalls, actionLabel, selectedAction || undefined)
    },
    [setDestinationInfo, selectedAction],
  )

  const renderActionPanel = () => {
    if (!selectedAction) return null

    const actionDef = getRegisteredActions().find((a) => a.id === selectedAction)
    if (!actionDef) return null

    const Panel = actionDef.panel
    const context = {
      tokenLists: tokenListsMeta,
      setDestinationInfo: wrappedSetDestinationInfo,
      srcCurrency,
      dstCurrency,
      slippage,
      chainId: dstChainId,
      actionData: actionData[selectedAction],
      marketsReady,
      quotes,
      selectedQuoteIndex,
      setSelectedQuoteIndex,
      requiresExactDestinationAmount: actionDef.requiresExactDestinationAmount ?? false,
      destinationInfo,
      isRequoting,
    }

    const props = actionDef.buildPanelProps
      ? actionDef.buildPanelProps(context)
      : {
          tokenLists: context.tokenLists,
          setDestinationInfo: context.setDestinationInfo,
        }

    return <Panel {...props} resetKey={resetKey !== undefined ? resetKey + panelResetKey : panelResetKey} />
  }

  const selectedActionDef = selectedAction ? getRegisteredActions().find((a) => a.id === selectedAction) : null

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-4">
          <ActionIconGrid
            actions={filteredActions}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedAction={selectedAction}
            onActionSelect={handleActionSelect}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            onReset={handleReset}
            srcCurrency={srcCurrency}
            onSrcCurrencyChange={onSrcCurrencyChange}
            isActionReady={isActionReady}
            isActionLoading={isActionLoading}
          />
        </div>
      </div>

      {selectedAction && selectedActionDef && (
        <div className="card bg-base-100 border border-primary/20 shadow-md">
          <div className="card-body p-0">
            <SelectedActionHeader action={selectedActionDef} isExpanded={isPanelExpanded} onToggle={handlePanelToggle} onClose={handleCloseAction} />
            {isPanelExpanded && <div className="p-4">{renderActionPanel()}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
