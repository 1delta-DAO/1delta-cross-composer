import { useMemo, useState } from "react"
import type { Hex } from "viem"
import { DestinationActionConfig, DestinationActionType } from "../../../lib/types/destinationAction"
import { getAllActions, getActionsByGroup } from "../../../lib/actions/registry"
import { GenericActionModal } from "./GenericActionModal"

interface NonLendingActionsPanelProps {
  dstToken?: string
  dstChainId?: string
  userAddress?: string
  onAdd?: (config: DestinationActionConfig, functionSelector: Hex, args?: any[], value?: string) => void
}

type ModalActionState = { config: DestinationActionConfig; selector: Hex } | null

export function GenericActionsPanel({ dstToken, dstChainId, userAddress, onAdd }: NonLendingActionsPanelProps) {
  const [selectedActionType, setSelectedActionType] = useState<DestinationActionType | "">("")
  const [selectedActionKey, setSelectedActionKey] = useState<string>("")
  const [modalAction, setModalAction] = useState<ModalActionState>(null)

  const allActions = useMemo(() => getAllActions({ dstToken, dstChainId }), [dstToken, dstChainId])

  // Only non-lending, non-Olderfall actions
  const nonLendingActions = useMemo(() => allActions.filter((a) => a.actionType !== "lending" && a.group !== "olderfall_nft"), [allActions])

  const actionsByType = useMemo(() => {
    if (!selectedActionType) {
      // Deduplicate by address-name combination
      const seen = new Set<string>()
      return nonLendingActions.filter((a) => {
        const key = `${a.address.toLowerCase()}-${a.name}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    return getActionsByGroup(selectedActionType, { dstToken, dstChainId }).filter((a) => a.actionType !== "lending" && a.group !== "olderfall_nft")
  }, [nonLendingActions, selectedActionType, dstToken, dstChainId])

  // If we can't add anything, don't render
  // No non-lending actions configured
  if (!onAdd || nonLendingActions.length === 0) {
    return null
  }

  const handleSelectActionKey = (val: string) => {
    setSelectedActionKey(val)
  }

  const handleClickAdd = () => {
    if (!selectedActionKey) return

    const [addr, selector] = selectedActionKey.split("|")
    const action = actionsByType.find((a) => a.address.toLowerCase() === addr)
    if (!action || !selector) return

    setModalAction({ config: action, selector: selector as Hex })
    setSelectedActionKey("")
  }

  const handleConfirmModal = (config: DestinationActionConfig, selector: Hex, args: any[], value?: string) => {
    onAdd(config, selector, args, value)
    setModalAction(null)
  }

  return (
    <div className="form-control">
      <div className="flex items-center gap-2">
        <select
          value={selectedActionType}
          onChange={(e) => {
            setSelectedActionType(e.target.value as DestinationActionType | "")
            setSelectedActionKey("")
          }}
          className="select select-bordered flex-1"
        >
          <option value="">All Types</option>
          <option value="game_token">Game Token</option>
          <option value="buy_ticket">Buy Ticket</option>
          <option value="custom">Custom</option>
        </select>

        <select value={selectedActionKey} onChange={(e) => handleSelectActionKey(e.target.value)} className="select select-bordered flex-1">
          <option value="">Choose an action...</option>
          {actionsByType.flatMap((action) => {
            const selectors = action.defaultFunctionSelector
              ? [action.defaultFunctionSelector, ...action.functionSelectors]
              : action.functionSelectors

            const uniq = Array.from(new Set(selectors.map((s) => s.toLowerCase())))

            return uniq.map((selector) => {
              const key = `${action.address.toLowerCase()}|${selector}`
              return (
                <option key={key} value={key}>
                  {action.name}
                </option>
              )
            })
          })}
        </select>

        <button className="btn btn-primary" disabled={!selectedActionKey} onClick={handleClickAdd}>
          Add
        </button>
      </div>

      {modalAction && (
        <GenericActionModal
          open={modalAction !== null}
          onClose={() => setModalAction(null)}
          actionConfig={modalAction.config}
          selector={modalAction.selector}
          userAddress={userAddress as any}
          chainId={dstChainId}
          onConfirm={handleConfirmModal}
        />
      )}
    </div>
  )
}
