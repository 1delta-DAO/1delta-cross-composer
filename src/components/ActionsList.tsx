import type { DestinationActionConfig } from "../lib/types/destinationAction"
import type { Hex } from "viem"

type PendingAction = {
  id: string
  config: DestinationActionConfig
  selector: Hex
  args: any[]
  value?: string
}

type ActionsListProps = {
  actions: PendingAction[]
  onRemove?: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  onEdit?: (action: PendingAction) => void
}

export function ActionsList({ actions, onRemove, onMoveUp, onMoveDown, onEdit }: ActionsListProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold opacity-70">Added Actions ({actions.length})</div>
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <div key={action.id} className="card bg-base-100 border border-base-300 hover:border-primary/50 transition-colors">
            <div className="card-body p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{action.config.name}</div>
                  {action.config.description && <div className="text-xs opacity-70 truncate">{action.config.description}</div>}
                  {action.args.length > 0 && (
                    <div className="text-xs opacity-50 mt-1">
                      {action.args.map((arg, i) => (
                        <span key={i} className="mr-2">
                          Arg {i + 1}: {String(arg).slice(0, 20)}
                          {String(arg).length > 20 ? "..." : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {onMoveUp && idx > 0 && (
                    <button className="btn btn-xs btn-ghost" onClick={() => onMoveUp(action.id)} aria-label="Move up">
                      ↑
                    </button>
                  )}
                  {onMoveDown && idx < actions.length - 1 && (
                    <button className="btn btn-xs btn-ghost" onClick={() => onMoveDown(action.id)} aria-label="Move down">
                      ↓
                    </button>
                  )}
                  {onEdit && (
                    <button className="btn btn-xs btn-ghost" onClick={() => onEdit(action)} aria-label="Edit">
                      ✎
                    </button>
                  )}
                  {onRemove && (
                    <button className="btn btn-xs btn-error" onClick={() => onRemove(action.id)} aria-label="Remove">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
