import React, { useState } from "react"
import { DESTINATION_ACTIONS, getDestinationActionsByType } from "../lib/config/destinationActions"
import { DestinationActionConfig, DestinationActionType } from "../lib/types/destinationAction"
import { Hex } from "viem"

interface DestinationActionSelectorProps {
    onAdd?: (config: DestinationActionConfig, functionSelector: Hex) => void
}

export default function DestinationActionSelector({ onAdd }: DestinationActionSelectorProps) {
    const [selectedActionType, setSelectedActionType] = useState<DestinationActionType | "">("")
    const [selectedAction, setSelectedAction] = useState<string>("")

    const actionsByType = selectedActionType ? getDestinationActionsByType(selectedActionType) : DESTINATION_ACTIONS

    const handleSelectAction = (actionAddress: string) => {
        setSelectedAction(actionAddress)
    }

    if (DESTINATION_ACTIONS.length === 0) {
        return (
            <div className="alert alert-info">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <span>No destination actions configured yet. Actions can be added via configuration files.</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Action Type</span>
                </label>
                <select
                    value={selectedActionType}
                    onChange={(e) => {
                        setSelectedActionType(e.target.value as DestinationActionType | "")
                        setSelectedAction("")
                    }}
                    className="select select-bordered w-full"
                >
                    <option value="">All Types</option>
                    <option value="game_token">Game Token</option>
                    <option value="buy_ticket">Buy Ticket</option>
                    <option value="custom">Custom</option>
                </select>
            </div>

            {actionsByType.length > 0 && (
                <div className="form-control">
                    <label className="label">
                        <span className="label-text font-medium">Select Action</span>
                    </label>
                    <select value={selectedAction} onChange={(e) => handleSelectAction(e.target.value)} className="select select-bordered w-full">
                        <option value="">Choose an action...</option>
                        {actionsByType.map((action) => (
                            <option key={action.address} value={action.address}>
                                {action.name} - {action.description}
                            </option>
                        ))}
                    </select>
                    <div className="mt-3">
                        <button
                            className="btn btn-primary"
                            disabled={!selectedAction}
                            onClick={() => {
                                const action = DESTINATION_ACTIONS.find((a) => a.address.toLowerCase() === selectedAction.toLowerCase())
                                if (!action) return
                                const selector = (action.defaultFunctionSelector || action.functionSelectors[0]) as Hex
                                if (onAdd) onAdd(action, selector)
                            }}
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
