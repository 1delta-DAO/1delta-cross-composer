import { useMemo, useEffect, useRef, Dispatch, SetStateAction } from 'react'
import type { RawCurrency, RawCurrencyAmount } from '../types/currency'
import { ActionIconGrid } from './actions/shared/ActionIconGrid'
import { SelectedActionHeader } from './actions/shared/SelectedActionHeader'
import {
  getRegisteredActions,
  getActionsByCategory,
  type ActionType,
  type ActionCategory,
  type ActionLoaderContext,
} from './actions/shared/actionDefinitions'
import { ActionHandler } from './actions/shared/types'
import { type GenericTrade } from '@1delta/lib-utils'
import BalanceDisplay from './balance/balanceDisplay'
import { PricesRecord } from '../hooks/prices/usePriceQuery'

export const initialState: UnifiedState = {
  selectedAction: null,
  selectedCategory: 'all',
  isExpanded: true,
  isPanelExpanded: true,
  actionData: {},
  actionDataLoading: {},
  panelResetKey: 0,
}

export interface UnifiedState {
  selectedAction: ActionType | null
  selectedCategory: ActionCategory
  isExpanded: boolean
  isPanelExpanded: boolean
  actionData: Record<string, any>
  actionDataLoading: Record<string, boolean>
  panelResetKey: number
}

interface ActionSelectorProps {
  state: UnifiedState
  setState: Dispatch<SetStateAction<UnifiedState>>
  pricesData?: PricesRecord
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  setDestinationInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  resetKey?: number
  onSrcCurrencyChange?: (currency: RawCurrency) => void
  destinationInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
}

/* -------------------------------------------------------------------------- */
/*                           COMPONENT START                                   */
/* -------------------------------------------------------------------------- */

export default function ActionSelector(props: ActionSelectorProps) {
  const {
    srcCurrency,
    dstCurrency,
    setDestinationInfo,
    quotes,
    selectedQuoteIndex,
    setSelectedQuoteIndex,
    slippage,
    resetKey,
    onSrcCurrencyChange,
    destinationInfo,
    pricesData,
    state,
    setState,
  } = props

  const {
    selectedAction,
    selectedCategory,
    isExpanded,
    isPanelExpanded,
    actionData,
    actionDataLoading,
    panelResetKey,
  } = state

  /* -------------------------------------------------------------------------- */
  /*                        Derived lists + memo fields                          */
  /* -------------------------------------------------------------------------- */

  const availableActions = useMemo(() => {
    return getRegisteredActions().filter((action) =>
      action.requiresSrcCurrency ? Boolean(srcCurrency) : true
    )
  }, [srcCurrency])

  const filteredActions = useMemo(() => {
    return getActionsByCategory(selectedCategory, srcCurrency)
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

  /* -------------------------------------------------------------------------- */
  /*                              Load Action Data                               */
  /* -------------------------------------------------------------------------- */

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
  }, [availableActions, srcCurrency, dstCurrency])

  /* -------------------------------------------------------------------------- */
  /*                Clear destination info if selectedAction changes            */
  /* -------------------------------------------------------------------------- */

  const prevActionRef = useRef<ActionType | null>(null)

  useEffect(() => {
    const prev = prevActionRef.current
    const cur = selectedAction

    if (prev && cur && prev !== cur) {
      setDestinationInfo?.(undefined, undefined, [])
    }

    prevActionRef.current = cur
  }, [selectedAction, setDestinationInfo])

  /* -------------------------------------------------------------------------- */
  /*                              Event Handlers                                 */
  /* -------------------------------------------------------------------------- */

  const handleReset = () => {
    setState((s) => ({
      ...initialState,
      panelResetKey: s.panelResetKey + 1,
    }))
    setDestinationInfo?.(undefined, undefined, [])
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
    setDestinationInfo?.(undefined, undefined, [])
  }

  /* -------------------------------------------------------------------------- */
  /*                               Panel Renderer                               */
  /* -------------------------------------------------------------------------- */

  const renderActionPanel = () => {
    if (!selectedAction) return null

    const def = getRegisteredActions().find((a) => a.id === selectedAction)
    if (!def) return null

    const Panel = def.panel

    const ctx = {
      setDestinationInfo,
      srcCurrency,
      dstCurrency,
      slippage,
      actionData: actionData[selectedAction],
      quotes,
      selectedQuoteIndex,
      setSelectedQuoteIndex,
      destinationInfo,
    }

    const props = def.buildPanelProps
      ? def.buildPanelProps(ctx)
      : { setDestinationInfo: ctx.setDestinationInfo }

    return <Panel {...props} resetKey={(resetKey ?? 0) + panelResetKey} />
  }

  const selectedDef = selectedAction
    ? getRegisteredActions().find((a) => a.id === selectedAction)
    : null

  /* -------------------------------------------------------------------------- */
  /*                                   Render                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <BalanceDisplay
        onSrcCurrencyChange={onSrcCurrencyChange}
        srcCurrency={srcCurrency}
        pricesData={pricesData}
      />
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
    </div>
  )
}
