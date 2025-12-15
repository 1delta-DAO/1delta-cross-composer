import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react'
import { ExecutionEvent } from '../utils/types'
import { useTxHistory } from '../../../contexts/TxHistoryContext'
import { useToast } from '../../common/ToastHost'

export interface TradeState {
  lastEventType: string | null
  lastEvent: ExecutionEvent | null
  srcHash: string | undefined
  dstHash: string | undefined
  confirmed: boolean
  isExecuting: boolean
}

interface HandleEventParams {
  isBridge: boolean
  hasActionCalls: boolean
  srcChainId?: string
  dstChainId?: string
  onTransactionEnd?: () => void
  onReset?: () => void
  onDone: (hashes: { src?: string; dst?: string; completed?: boolean }) => void
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
  setExecState: Dispatch<SetStateAction<TradeState>>
  execState: TradeState
}

/**
 * Map SDK events to UI events
 * An integrator has to map the sdk event so the statuses to be shown in the UI.
 */
export function useHandleEvent(params: HandleEventParams) {
  const {
    isBridge,
    hasActionCalls,
    srcChainId,
    dstChainId,
    onDone,
    onTransactionEnd,
    onReset,
    onResetStateChange,
    setExecState,
    execState,
  } = params

  const { createEntry, updateEntry } = useTxHistory()
  const historyIdRef = useRef<string | null>(null)

  const toast = useToast()

  // Main event handler
  const handleEvent = useCallback(
    (evt: ExecutionEvent) => {
      // update last event
      setExecState((s) => ({ ...s, lastEventType: evt.type, lastEvent: evt }))

      switch (evt.type) {
        case 'tx:sent': {
          const txHash = evt.src

          setExecState((s) => ({
            ...s,
            srcHash: txHash,
          }))

          const entryType =
            isBridge && hasActionCalls ? 'bridge_with_actions' : isBridge ? 'bridge' : 'swap'

          if (!historyIdRef.current) {
            historyIdRef.current = createEntry({
              type: entryType as any,
              srcChainId,
              dstChainId,
              srcHash: txHash,
              status: 'pending',
              dstHash: undefined,
              hasDestinationActions: Boolean(hasActionCalls),
            })
          } else {
            updateEntry(historyIdRef.current, {
              srcHash: txHash,
              status: 'pending',
            })
          }
          break
        }

        case 'tx:confirmed': {
          const hash = evt.src

          if (!isBridge) {
            if (historyIdRef.current) {
              updateEntry(historyIdRef.current, { status: 'completed' })
            }
            onTransactionEnd?.()
            setExecState((s) => ({ ...s, srcHash: hash, confirmed: true }))
            onDone({ src: hash })
          } else {
            setExecState((s) => ({ ...s, srcHash: hash }))
          }
          break
        }

        case 'update': {
          const { dst: dh, completed } = evt

          setExecState((s) => ({
            ...s,
            dstHash: dh ?? s.dstHash,
            confirmed: completed ?? s.confirmed,
          }))
          break
        }

        case 'done': {
          const { src: sh, dst: dh, completed } = evt

          setExecState((s) => ({
            ...s,
            srcHash: sh ?? s.srcHash,
            dstHash: dh ?? s.dstHash,
            confirmed: Boolean(dh || completed),
          }))

          if (historyIdRef.current) {
            updateEntry(historyIdRef.current, {
              dstHash: dh || undefined,
              status: dh || completed ? 'completed' : 'failed',
            })
          }

          toast.showSuccess('Transaction success')
          onTransactionEnd?.()
          onDone({ src: sh, dst: dh, completed: Boolean(dh || completed) })

          setExecState((s) => ({ ...s, isExecuting: false }))
          break
        }

        case 'error': {
          toast.showError((evt as any).error?.message || 'Transaction failed')

          if (historyIdRef.current) {
            updateEntry(historyIdRef.current, { status: 'failed' })
          }

          onTransactionEnd?.()
          setExecState((s) => ({ ...s, isExecuting: false }))
          break
        }
      }
    },
    [
      createEntry,
      updateEntry,
      isBridge,
      hasActionCalls,
      srcChainId,
      dstChainId,
      onDone,
      onTransactionEnd,
      toast,
    ]
  )
  const confirmFlag = Boolean(execState.confirmed)
  // Notify parent about reset availability
  useEffect(() => {
    const resetCallback = () => {
      setExecState({
        lastEventType: null,
        lastEvent: null,
        srcHash: undefined,
        dstHash: undefined,
        confirmed: false,
        isExecuting: false,
      })
      onReset?.()
    }
    const showReset = Boolean(confirmFlag && execState.srcHash)
    onResetStateChange?.(showReset, showReset ? resetCallback : undefined)
  }, [confirmFlag, onResetStateChange, onReset])

  return handleEvent
}
