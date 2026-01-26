import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import { usePublicClient, useAccount, useWalletClient } from 'wagmi'
import type { GenericTrade } from '../../sdk/types'
import { buildTransactionUrl } from '../../lib/explorer'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { useToast } from '../common/ToastHost'
import { WalletConnect } from '../connect'
import type { RawCurrency } from '../../types/currency'
import { ExecutionEvent } from './utils/types'
import { executeTrade } from './utils/executeTrade'
import { useUnifiedApprovals } from './hooks/useUnifiedApprovals'
import { TradeState, useHandleEvent } from './hooks/useHandleEvent'
import { useSyncChain } from './hooks/useSyncChain'
import { useLendingApprovals } from './hooks/useLendingApprovals'

type StepStatus = 'idle' | 'active' | 'done' | 'error'

function Step({ label, status }: { label: string; status: StepStatus }) {
  const icon =
    status === 'done' ? '✅' : status === 'error' ? '❌' : status === 'active' ? '⏳' : '•'

  const cls =
    status === 'error'
      ? 'text-error'
      : status === 'done'
        ? 'text-success'
        : status === 'active'
          ? 'text-warning'
          : ''

  return (
    <div className={`flex items-center gap-1 ${cls}`}>
      <span>{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

const initialState = {
  lastEventType: null as string | null,
  lastEvent: null as ExecutionEvent | null,
  srcHash: undefined as string | undefined,
  dstHash: undefined as string | undefined,
  confirmed: false,
  isExecuting: false,
}

type ExecuteButtonProps = {
  trade?: GenericTrade
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  amountWei?: string
  onDone: (hashes: { src?: string; dst?: string; completed?: boolean }) => void
  chains?: ReturnType<typeof useChainsRegistry>['data']
  onReset?: () => void
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
  onTransactionStart?: () => void
  onTransactionEnd?: () => void
  hasActionCalls?: boolean
  inputCalls?: import('../actions/shared/types').ActionCall[]
  quoting?: boolean
}

export default function ExecuteButton(props: ExecuteButtonProps) {
  const {
    trade,
    srcCurrency,
    dstCurrency,
    amountWei,
    onDone,
    chains,
    onReset,
    onResetStateChange,
    onTransactionStart,
    onTransactionEnd,
    hasActionCalls = false,
    inputCalls,
    quoting,
  } = props

  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const toast = useToast()

  // tracker instance
  const trackerRef = useRef<ReturnType<typeof executeTrade> | null>(null)

  // Unified execution state (Option 2)
  const [execState, setExecState] = useState<TradeState>(initialState)

  const { lastEventType, srcHash, dstHash, confirmed, isExecuting } = execState

  const prevTradeRef = useRef(trade)

  useEffect(() => {
    if (trade && trade !== prevTradeRef.current && !execState.isExecuting) {
      setExecState(initialState)
    }
    prevTradeRef.current = trade
  }, [trade, execState.lastEventType, execState.isExecuting, execState.srcHash])

  // Utility derived values
  const srcChainId = srcCurrency?.chainId
  const dstChainId = dstCurrency?.chainId
  const isBridge = Boolean(srcChainId && dstChainId && srcChainId !== dstChainId)

  const srcTokenAddress = useMemo(
    () => srcCurrency?.address?.toLowerCase() as Address | undefined,
    [srcCurrency]
  )
  const spender = trade ? (trade as any).approvalTarget || (trade as any).target : undefined
  const skipApprove = trade ? (trade as any).skipApprove || false : false

  const shouldSkipUnderlyingApproval = hasActionCalls && inputCalls && inputCalls.length > 0

  const tokenApprovals = useMemo(() => {
    if (
      !srcTokenAddress ||
      srcTokenAddress === zeroAddress ||
      !spender ||
      skipApprove ||
      shouldSkipUnderlyingApproval ||
      !amountWei
    ) {
      return []
    }
    return [
      {
        token: srcTokenAddress,
        spender: spender as Address,
        amount: amountWei,
      },
    ]
  }, [srcTokenAddress, spender, amountWei, skipApprove, shouldSkipUnderlyingApproval])

  const { needsAnyApproval: needsApproval } = useUnifiedApprovals(
    address,
    srcChainId,
    tokenApprovals,
    skipApprove || shouldSkipUnderlyingApproval
  )

  const { approvals: mTokenApprovals, needsAnyApproval: needsMTokenApproval } = useLendingApprovals(
    address,
    hasActionCalls ? inputCalls : undefined,
    srcChainId
  )

  /** Get event handler */
  const handleEvent = useHandleEvent({
    srcChainId,
    dstChainId,
    onDone,
    onTransactionEnd,
    isBridge,
    hasActionCalls,
    execState,
    setExecState,
    onReset,
    onResetStateChange,
  })

  const { data: walletClient } = useWalletClient({ account: address })

  // Execute function
  const execute = useCallback(async () => {
    if (!address || !srcChainId || !trade) {
      toast.showError('Missing required parameters')
      return
    }

    onTransactionStart?.()

    setExecState({
      lastEventType: null,
      lastEvent: null,
      srcHash: undefined,
      dstHash: undefined,
      confirmed: false,
      isExecuting: true,
    })
    try {
      const tracker = executeTrade({
        trade: trade as GenericTrade,
        walletClient: walletClient as any,
        publicClient: publicClient as any,
        needsApproval,
        mTokenApprovals: needsMTokenApproval ? mTokenApprovals : undefined,
      })

      trackerRef.current = tracker

      tracker.on(handleEvent)

      try {
        await tracker.done
      } catch {
        // already handled
      } finally {
        tracker.off(handleEvent)
      }
    } catch (err: any) {
      toast.showError(err?.message || 'Execution failed')
      onTransactionEnd?.()
      setExecState((s) => ({ ...s, isExecuting: false }))
    }
  }, [
    address,
    srcChainId,
    trade,
    onTransactionStart,
    walletClient,
    publicClient,
    needsApproval,
    needsMTokenApproval,
    mTokenApprovals,
    handleEvent,
    toast,
    onTransactionEnd,
  ])

  // UI step mapping
  const step = useMemo(() => {
    if (!lastEventType) return 'idle'
    if (lastEventType.startsWith('approval')) return 'approving'
    if (lastEventType === 'tx:signing') return 'signing'
    if (lastEventType === 'tx:sent') return 'broadcast'
    if (lastEventType === 'tx:confirmed' || lastEventType === 'done') return 'confirmed'
    if (lastEventType === 'error') return 'error'
    return 'idle'
  }, [lastEventType])

  const shouldShow = (name: 'approving' | 'signing' | 'broadcast' | 'confirmed') => {
    const order = ['approving', 'signing', 'broadcast', 'confirmed']
    const currentIdx = order.indexOf(step as any)
    const idx = order.indexOf(name)
    if (step === 'error') return true
    if (step === 'idle') return false
    return idx <= currentIdx
  }

  const { syncChain, currentChainId } = useSyncChain()

  return (
    <div className="space-y-3">
      <>
        {!isConnected ? (
          <div className="w-full flex justify-center">
            <WalletConnect />
          </div>
        ) : currentChainId !== Number(srcChainId) ? (
          <button className="btn btn-warning w-full" onClick={() => syncChain(Number(srcChainId))}>
            Switch Wallet Chain
          </button>
        ) : quoting ? (
          <button className="btn btn-primary w-full" disabled>
            <span className="loading loading-spinner loading-sm"></span>
            {isBridge ? 'Loading bridge quote...' : 'Loading swap quote...'}
          </button>
        ) : !trade ? (
          <button className="btn btn-primary w-full" disabled>
            {isBridge ? 'Bridge' : 'Swap'}
          </button>
        ) : (
          <button className="btn btn-primary w-full" onClick={execute} disabled={isExecuting}>
            {isExecuting ? 'Executing...' : isBridge ? 'Bridge' : 'Swap'}
          </button>
        )}
      </>

      {/* Step indicators */}
      {step !== 'idle' && isExecuting && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {(needsApproval || needsMTokenApproval) && shouldShow('approving') && (
              <Step
                label={needsMTokenApproval ? 'Approve mToken' : 'Approve token'}
                status={step === 'approving' ? 'active' : step === 'error' ? 'error' : 'done'}
              />
            )}

            {shouldShow('signing') && (
              <Step
                label={isBridge ? 'Prepare bridge' : 'Prepare swap'}
                status={
                  step === 'signing'
                    ? 'active'
                    : step === 'error'
                      ? 'error'
                      : step === 'confirmed'
                        ? 'done'
                        : 'idle'
                }
              />
            )}

            {shouldShow('broadcast') && (
              <Step
                label="Send tx"
                status={
                  step === 'broadcast'
                    ? 'active'
                    : step === 'error'
                      ? 'error'
                      : step === 'confirmed'
                        ? 'done'
                        : 'idle'
                }
              />
            )}

            {shouldShow('confirmed') && (
              <Step
                label="Confirmed"
                status={step === 'confirmed' ? 'done' : step === 'error' ? 'error' : 'idle'}
              />
            )}
          </div>
        </div>
      )}

      {/* Source TX */}
      {srcHash && srcChainId && (
        <div className="space-y-2">
          <div className="text-sm flex items-center gap-2">
            <span>Source tx:</span>
            <a
              href={buildTransactionUrl(chains || {}, srcChainId, srcHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline"
            >
              {srcHash.slice(0, 4)}...{srcHash.slice(-4)}
            </a>
            {confirmed ? (
              <span className="text-success">✓</span>
            ) : (
              <span className="loading loading-spinner loading-xs"></span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
