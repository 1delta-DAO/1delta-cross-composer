import { useMemo, useEffect, useRef, Dispatch, SetStateAction } from 'react'
import type { RawCurrency, RawCurrencyAmount } from '../types/currency'
import { ActionIconGrid } from './actions/shared/ActionIconGrid'
import { SelectedActionHeader } from './actions/shared/SelectedActionHeader'
import {
  getRegisteredActions,
  getActionsByCategory,
  type ActionType,
  type ActionLoaderContext,
  type ActionPanelContext,
} from './actions/shared/actionDefinitions'
import { ActionHandler } from './actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import BalanceDisplay from './balance/balanceDisplay'
import { PricesRecord } from '../hooks/prices/usePriceQuery'
import { initialState, UnifiedState } from './ActionSelector'

interface ReverseActionSelectorProps {
  state: UnifiedState
  setState: Dispatch<SetStateAction<UnifiedState>>
  pricesData?: PricesRecord
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  setActionInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  resetKey?: number
  onDstCurrencyChange?: (currency: RawCurrency) => void
  actionInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
}

export default function ReverseActionSelector({
  srcCurrency,
  dstCurrency,
  setActionInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  resetKey,
  onDstCurrencyChange,
  actionInfo,
  pricesData,
  state,
  setState,
}: ReverseActionSelectorProps) {
  const {
    selectedAction,
    selectedCategory,
    isExpanded,
    isPanelExpanded,
    actionData,
    actionDataLoading,
    panelResetKey,
  } = state

  const availableActions = useMemo(() => {
    return getRegisteredActions().filter((action) => {
      const direction = action.actionDirection || 'destination'
      if (direction !== 'input') return false
      if (action.requiresSrcCurrency) {
        return Boolean(srcCurrency)
      }
      return true
    })
  }, [srcCurrency])

  const filteredActions = useMemo(() => {
    return getActionsByCategory(selectedCategory, srcCurrency, 'input')
  }, [selectedCategory, srcCurrency])

  const isActionReady = useMemo(() => {
    const ready: Record<string, boolean> = {}
    availableActions.forEach((action) => {
      const isLoading = actionDataLoading[action.id]
      const hasData = actionData[action.id] != null
      ready[action.id] = action.dataLoader ? !isLoading && hasData : true
    })
    return ready
  }, [availableActions, actionDataLoading, actionData])

  const isActionLoading = useMemo(() => {
    const o: Record<string, boolean> = {}
    availableActions.forEach((a) => (o[a.id] = actionDataLoading[a.id]))
    return o
  }, [availableActions, actionDataLoading])

  useEffect(() => {
    const load = async () => {
      const ctx: ActionLoaderContext = { srcCurrency, dstCurrency }

      await Promise.all(
        availableActions.map(async (action) => {
          if (!action.dataLoader) return

          setState((s) => ({
            ...s,
            actionDataLoading: { ...s.actionDataLoading, [action.id]: true },
          }))

          try {
            const data = await action.dataLoader(ctx)
            setState((s) => ({
              ...s,
              actionData: { ...s.actionData, [action.id]: data },
            }))
          } catch (e) {
            console.error('Failed to load:', action.id, e)
            setState((s) => ({
              ...s,
              actionData: { ...s.actionData, [action.id]: null },
            }))
          } finally {
            setState((s) => ({
              ...s,
              actionDataLoading: { ...s.actionDataLoading, [action.id]: false },
            }))
          }
        })
      )
    }

    load()
  }, [availableActions, srcCurrency, dstCurrency, setState])

  const prevActionRef = useRef<ActionType | null>(null)

  useEffect(() => {
    const prev = prevActionRef.current
    const cur = selectedAction

    if (prev && cur && prev !== cur) {
      setActionInfo?.(undefined, undefined, [])
    }

    prevActionRef.current = cur
  }, [selectedAction, setActionInfo])

  const handleReset = () => {
    setState((s) => ({
      ...initialState,
      panelResetKey: s.panelResetKey + 1,
    }))
    setActionInfo?.(undefined, undefined, [])
  }

  const handleActionSelect = (id: ActionType) => {
    const def = availableActions.find((a) => a.id === id)
    if (!def) return

    const isLoading = actionDataLoading[id]
    const hasData = actionData[id] != null

    if (def.dataLoader && (isLoading || !hasData)) return

    setState((s) => ({
      ...s,
      selectedAction: id,
      isExpanded: false,
      isPanelExpanded: true,
    }))
  }

  const handleCloseAction = () => {
    setState((s) => ({
      ...s,
      selectedAction: null,
      isPanelExpanded: true,
      panelResetKey: s.panelResetKey + 1,
    }))
    setActionInfo?.(undefined, undefined, [])
  }

  const renderActionPanel = () => {
    if (!selectedAction) return null

    const def = getRegisteredActions().find((a) => a.id === selectedAction)
    if (!def) return null

    const Panel = def.panel

    const ctx: ActionPanelContext = {
      setActionInfo,
      srcCurrency,
      dstCurrency,
      slippage,
      actionData: actionData[selectedAction],
      quotes,
      selectedQuoteIndex,
      setSelectedQuoteIndex,
      actionInfo,
    }

    const props = def.buildPanelProps
      ? def.buildPanelProps(ctx)
      : { setActionInfo: ctx.setActionInfo }

    return <Panel {...props} resetKey={(resetKey ?? 0) + panelResetKey} />
  }

  const selectedDef = selectedAction
    ? getRegisteredActions().find((a) => a.id === selectedAction)
    : null

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-4">
          <ActionIconGrid
            actions={filteredActions}
            selectedCategory={selectedCategory}
            onCategoryChange={(cat) => setState((s) => ({ ...s, selectedCategory: cat }))}
            selectedAction={selectedAction}
            onActionSelect={handleActionSelect}
            isExpanded={isExpanded}
            onToggleExpand={() => setState((s) => ({ ...s, isExpanded: !s.isExpanded }))}
            onReset={handleReset}
            isActionReady={isActionReady}
            isActionLoading={isActionLoading}
            isReverseFlow={true}
          />
        </div>
      </div>

      {selectedAction && selectedDef && (
        <div className="card bg-base-100 border border-primary/20 shadow-md">
          <div className="card-body p-0">
            <SelectedActionHeader
              action={selectedDef}
              isExpanded={isPanelExpanded}
              onToggle={() => setState((s) => ({ ...s, isPanelExpanded: !s.isPanelExpanded }))}
              onClose={handleCloseAction}
            />
            {isPanelExpanded && <div className="p-4">{renderActionPanel()}</div>}
          </div>
        </div>
      )}

      {onDstCurrencyChange && (
        <BalanceDisplay
          onSrcCurrencyChange={onDstCurrencyChange}
          srcCurrency={dstCurrency}
          pricesData={pricesData}
        />
      )}
    </div>
  )
}
