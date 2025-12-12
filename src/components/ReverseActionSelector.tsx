import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import type { RawCurrency, RawCurrencyAmount } from '../types/currency'
import { ActionIconGrid } from './actions/shared/ActionIconGrid'
import { SelectedActionHeader } from './actions/shared/SelectedActionHeader'
import { DestinationTokenSelector } from './actions/shared/DestinationTokenSelector'
import {
  getRegisteredActions,
  getActionsByCategory,
  type ActionType,
  type ActionCategory,
  type InputActionLoaderContext,
  type InputActionPanelContext,
} from './actions/shared/actionDefinitions'
import { ActionHandler } from './actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import { useChainsRegistry } from '../sdk/hooks/useChainsRegistry'

interface ReverseActionSelectorProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  setInputInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  resetKey?: number
  onDstCurrencyChange?: (currency: RawCurrency) => void
  inputInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
}

export default function ReverseActionSelector({
  srcCurrency,
  dstCurrency,
  setInputInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  resetKey,
  onDstCurrencyChange,
  inputInfo,
}: ReverseActionSelectorProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory>('all')
  const [isExpanded, setIsExpanded] = useState(true)
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const [actionData, setActionData] = useState<Record<string, any>>({})
  const [actionDataLoading, setActionDataLoading] = useState<Record<string, boolean>>({})
  const [panelResetKey, setPanelResetKey] = useState(0)

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
      const isLoading = actionDataLoading[action.id] === true
      const hasData = actionData[action.id] !== null && actionData[action.id] !== undefined

      if (action.dataLoader) {
        ready[action.id] = !isLoading && hasData
      } else {
        ready[action.id] = true
      }
    })

    return ready
  }, [availableActions, srcCurrency, actionDataLoading, actionData])

  const isActionLoading = useMemo(() => {
    const loading: Record<string, boolean> = {}
    availableActions.forEach((action) => {
      const isDataLoading = actionDataLoading[action.id] === true
      loading[action.id] = isDataLoading
    })
    return loading
  }, [availableActions, actionDataLoading])

  useEffect(() => {
    const loadActionData = async () => {
      const loaderContext: InputActionLoaderContext = {
        srcCurrency,
        dstCurrency,
      }

      const loadPromises = availableActions.map(async (action) => {
        if (!action.dataLoader) return

        try {
          setActionDataLoading((prev) => ({ ...prev, [action.id]: true }))
          const dataLoader = action.dataLoader as (
            context: InputActionLoaderContext
          ) => Promise<any>
          const data = await dataLoader(loaderContext)
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
  }, [availableActions, srcCurrency, dstCurrency])

  const prevSelectedActionRef = useRef<ActionType | null>(null)

  useEffect(() => {
    const prevAction = prevSelectedActionRef.current
    const currentAction = selectedAction

    if (prevAction !== null && currentAction !== null && prevAction !== currentAction) {
      setInputInfo?.(undefined, undefined, [])
    }

    prevSelectedActionRef.current = currentAction
  }, [selectedAction, setInputInfo])

  const handleReset = () => {
    setSelectedAction(null)
    setSelectedCategory('all')
    setIsExpanded(true)
    setIsPanelExpanded(true)

    setInputInfo?.(undefined, undefined, [])

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
    setInputInfo?.(undefined, undefined, [])
    setPanelResetKey((prev) => prev + 1)
  }

  const wrappedSetInputInfo = useCallback<ActionHandler>(
    (currencyAmount, receiverAddress, inputCalls, actionLabel) => {
      setInputInfo?.(
        currencyAmount,
        receiverAddress,
        inputCalls,
        actionLabel,
        selectedAction || undefined
      )
    },
    [setInputInfo, selectedAction]
  )

  const renderActionPanel = () => {
    if (!selectedAction) return null

    const actionDef = getRegisteredActions().find((a) => a.id === selectedAction)
    if (!actionDef) return null

    const Panel = actionDef.panel
    const context: InputActionPanelContext = {
      setInputInfo: wrappedSetInputInfo,
      srcCurrency,
      dstCurrency,
      slippage,
      actionData: actionData[selectedAction],
      quotes,
      selectedQuoteIndex,
      setSelectedQuoteIndex,
      inputInfo,
    }

    const props = actionDef.buildPanelProps
      ? actionDef.buildPanelProps(context)
      : {
          setInputInfo: context.setInputInfo,
        }

    return (
      <Panel
        {...props}
        resetKey={resetKey !== undefined ? resetKey + panelResetKey : panelResetKey}
      />
    )
  }

  const selectedActionDef = selectedAction
    ? getRegisteredActions().find((a) => a.id === selectedAction)
    : null

  const { data: chains } = useChainsRegistry()

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
            dstCurrency={dstCurrency}
            onDstCurrencyChange={onDstCurrencyChange}
            isActionReady={isActionReady}
            isActionLoading={isActionLoading}
            isReverseFlow={true}
          />
        </div>
      </div>

      {selectedAction && selectedActionDef && (
        <div className="card bg-base-100 border border-primary/20 shadow-md">
          <div className="card-body p-0">
            <SelectedActionHeader
              action={selectedActionDef}
              isExpanded={isPanelExpanded}
              onToggle={handlePanelToggle}
              onClose={handleCloseAction}
            />
            {isPanelExpanded && <div className="p-4">{renderActionPanel()}</div>}
          </div>
        </div>
      )}

      {onDstCurrencyChange && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Select output token</span>
              <DestinationTokenSelector
                dstCurrency={dstCurrency}
                onCurrencyChange={onDstCurrencyChange}
                chains={chains}
                isReverseFlow={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
