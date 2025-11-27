import type { ActionDefinition } from './actionDefinitions'

interface SelectedActionHeaderProps {
  action: ActionDefinition
  isExpanded: boolean
  onToggle: () => void
  onClose: () => void
}

export function SelectedActionHeader({
  action,
  isExpanded,
  onToggle,
  onClose,
}: SelectedActionHeaderProps) {
  const Icon = action.icon

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
            onClick={onToggle}
          >
            <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
            <Icon className="h-5 w-5" />
            <span className="font-medium">{action.label}</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            title="Close"
          >
            <span className="text-lg">×</span>
          </button>
        </div>
      </div>
    </div>
  )
}
