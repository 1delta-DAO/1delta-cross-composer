import { useMemo } from 'react'
import type { ActionDefinition, ActionCategory, ActionType } from './actionDefinitions'
import { CATEGORIES } from './actionDefinitions'
import type { RawCurrency } from '../../../types/currency'
import { useContainerWidth } from '../../../hooks/useContainerWidth'

interface ActionIconGridProps {
  actions: ActionDefinition[]
  selectedCategory: ActionCategory
  onCategoryChange: (category: ActionCategory) => void
  selectedAction: ActionType | null
  onActionSelect: (action: ActionType) => void
  isExpanded: boolean
  onToggleExpand: () => void
  onReset: () => void
  srcCurrency?: RawCurrency
  isActionReady?: Record<string, boolean>
  isActionLoading?: Record<string, boolean>
}

export function ActionIconGrid({
  actions,
  selectedCategory,
  onCategoryChange,
  selectedAction,
  onActionSelect,
  isExpanded,
  onToggleExpand,
  onReset,
  srcCurrency,
  isActionReady,
  isActionLoading,
}: ActionIconGridProps) {
  const { containerRef, width } = useContainerWidth()

  const filteredActions = useMemo(() => {
    if (selectedCategory === 'all') {
      return actions
    }
    return actions.filter((action) => action.category === selectedCategory)
  }, [actions, selectedCategory])

  const maxVisibleItems = useMemo(() => {
    if (width === 0) return 3

    const buttonWidth = 130
    const gapWidth = 8
    const plusButtonWidth = 60
    const reservedSpace = 100

    const availableWidth = width - reservedSpace
    const itemsWithCounter = Math.floor((availableWidth - plusButtonWidth - gapWidth) / (buttonWidth + gapWidth))
    const itemsWithoutCounter = Math.floor(availableWidth / (buttonWidth + gapWidth))

    const maxItems = Math.max(itemsWithCounter, itemsWithoutCounter)

    return Math.max(2, Math.min(maxItems, 50))
  }, [width])

  const collapsedActions = useMemo(() => {
    const allActionsSorted = [...filteredActions].sort((a, b) => a.priority - b.priority)

    if (!selectedAction) {
      return allActionsSorted.slice(0, maxVisibleItems)
    }

    const selectedActionDef = allActionsSorted.find((a) => a.id === selectedAction)
    if (!selectedActionDef) {
      return allActionsSorted.slice(0, maxVisibleItems)
    }

    const selectedIndex = allActionsSorted.findIndex((a) => a.id === selectedAction)
    const isInVisibleRange = selectedIndex < maxVisibleItems

    if (isInVisibleRange) {
      return allActionsSorted.slice(0, maxVisibleItems)
    }

    const remainingSlots = maxVisibleItems - 1
    const otherActions = allActionsSorted.filter((a) => a.id !== selectedAction).slice(0, remainingSlots)
    return [selectedActionDef, ...otherActions]
  }, [filteredActions, selectedAction, maxVisibleItems])

  const handleActionClick = (actionId: ActionType) => {
    onActionSelect(actionId)
    if (isExpanded) {
      onToggleExpand()
    }
  }

  const visibleCount = collapsedActions.length
  const totalFilteredActions = filteredActions.length
  const actualRemainingCount = Math.max(0, totalFilteredActions - visibleCount)

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Category Tabs */}
      {isExpanded && (
        <div className="tabs tabs-boxed">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`tab ${selectedCategory === category.id ? 'tab-active' : ''}`}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}

      {/* Action Icons */}
      {isExpanded ? (
        /* Expanded View - Grid */
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredActions.map((action) => {
            const Icon = action.icon
            const isSelected = selectedAction === action.id
            const isReady = isActionReady?.[action.id] ?? true
            const isLoading = isActionLoading?.[action.id] === true
            return (
              <button
                key={action.id}
                type="button"
                className={`btn btn-outline flex flex-col items-center gap-2 h-auto py-4 relative ${isSelected ? 'btn-primary' : ''} ${
                  !isReady ? 'opacity-50' : ''
                }`}
                onClick={() => isReady && handleActionClick(action.id)}
                disabled={!isReady}
              >
                {isLoading && <span className="loading loading-spinner loading-xs absolute top-1 right-1"></span>}
                <Icon className={isSelected ? 'text-primary' : ''} />
                <span className="text-xs">{action.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        /* Collapsed View*/
        <div className="flex items-center gap-2 flex-wrap">
          {collapsedActions.map((action) => {
            const Icon = action.icon
            const isSelected = selectedAction === action.id
            const isReady = isActionReady?.[action.id] ?? true
            const isLoading = isActionLoading?.[action.id] === true
            return (
              <button
                key={action.id}
                type="button"
                className={`btn btn-sm btn-outline flex items-center gap-2 relative ${isSelected ? 'btn-primary' : ''} ${
                  !isReady ? 'opacity-50' : ''
                }`}
                onClick={() => isReady && handleActionClick(action.id)}
                disabled={!isReady}
                title={action.label}
              >
                {isLoading && <span className="loading loading-spinner loading-xs absolute -top-1 -right-1"></span>}
                <Icon className={isSelected ? 'text-primary' : ''} />
                <span className="text-xs">{action.label}</span>
              </button>
            )
          })}
          {actualRemainingCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline flex items-center gap-2"
              onClick={onToggleExpand}
              title={`${actualRemainingCount} more action${actualRemainingCount > 1 ? 's' : ''}`}
            >
              <span className="text-xs">+{actualRemainingCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 justify-end">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onToggleExpand} title={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
    </div>
  )
}
