import { useMemo } from "react"
import type { ActionDefinition, ActionCategory, ActionType } from "./actionDefinitions"
import { CATEGORIES, getPriorityActions, getRemainingActionsCount } from "./actionDefinitions"
import type { RawCurrency } from "../../../types/currency"

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
  const filteredActions = useMemo(() => {
    if (selectedCategory === "all") {
      return actions
    }
    return actions.filter((action) => action.category === selectedCategory)
  }, [actions, selectedCategory])

  const priorityActions = useMemo(() => getPriorityActions(srcCurrency), [srcCurrency])
  const remainingCount = useMemo(() => getRemainingActionsCount(priorityActions, srcCurrency), [priorityActions, srcCurrency])

  const collapsedActions = useMemo(() => {
    if (!selectedAction) {
      return priorityActions
    }

    const selectedActionDef = actions.find((a) => a.id === selectedAction)
    if (!selectedActionDef) {
      return priorityActions
    }

    const isSelectedInPriority = priorityActions.some((a) => a.id === selectedAction)

    if (isSelectedInPriority) {
      return priorityActions
    }

    return [selectedActionDef, ...priorityActions.slice(0, 2)]
  }, [priorityActions, selectedAction, actions])

  const handleActionClick = (actionId: ActionType) => {
    onActionSelect(actionId)
    if (isExpanded) {
      onToggleExpand()
    }
  }

  return (
    <div className="space-y-3">
      {/* Category Tabs */}
      <div className="tabs tabs-boxed">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`tab ${selectedCategory === category.id ? "tab-active" : ""}`}
            onClick={() => onCategoryChange(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

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
                className={`btn btn-outline flex flex-col items-center gap-2 h-auto py-4 relative ${isSelected ? "btn-primary" : ""} ${
                  !isReady ? "opacity-50" : ""
                }`}
                onClick={() => isReady && handleActionClick(action.id)}
                disabled={!isReady}
              >
                {isLoading && <span className="loading loading-spinner loading-xs absolute top-1 right-1"></span>}
                <Icon className={isSelected ? "text-primary" : ""} />
                <span className="text-xs">{action.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        /* Collapsed View - Priority Actions + Counter */
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
                className={`btn btn-sm btn-outline flex items-center gap-2 relative ${isSelected ? "btn-primary" : ""} ${
                  !isReady ? "opacity-50" : ""
                }`}
                onClick={() => isReady && handleActionClick(action.id)}
                disabled={!isReady}
                title={action.label}
              >
                {isLoading && <span className="loading loading-spinner loading-xs absolute -top-1 -right-1"></span>}
                <Icon className={isSelected ? "text-primary" : ""} />
                <span className="text-xs">{action.label}</span>
              </button>
            )
          })}
          {remainingCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline flex items-center gap-2"
              onClick={onToggleExpand}
              title={`${remainingCount} more action${remainingCount > 1 ? "s" : ""}`}
            >
              <span className="text-xs">+{remainingCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 justify-end">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onToggleExpand} title={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? "▲" : "▼"}
        </button>
      </div>
    </div>
  )
}
