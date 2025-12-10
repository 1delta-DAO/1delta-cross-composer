import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import {
  useSendTransaction,
  useWriteContract,
  usePublicClient,
  useReadContract,
  useConnection,
  useSwitchChain,
} from 'wagmi'
import type { GenericTrade } from '../../sdk/types'
import { buildTransactionUrl } from '../../lib/explorer'
import { erc20Abi } from 'viem'
import type { ActionCall } from '../actions/shared/types'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { useToast } from '../common/ToastHost'
import { WalletConnect } from '../connect'
import { useTxHistory } from '../../contexts/TxHistoryContext'
import type { RawCurrency } from '../../types/currency'
import { getBridgeStatus } from '@1delta/trade-sdk'
import { getViemProvider } from '@1delta/lib-utils'
import { getTransactionData } from './utils/getTransactionData'

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

/**
 * Provide a current status from a trade
 * @param fromHash tx hash on source chain
 * @param trade trade object
 * @returns status object
 */
async function getStatusFromTrade(fromHash: string, trade: GenericTrade) {
  // same chain case
  if (trade.inputAmount.currency.chainId === trade.outputAmount.currency.chainId) {
    const provider = await getViemProvider({ chainId: trade.inputAmount.currency.chainId })
    const receipt = await provider
      ?.getTransactionReceipt({ hash: fromHash as any })
      .catch(() => null)

    if (!receipt) {
      return {
        code: null,
        fromHash: fromHash,
        toHash: fromHash,
        status: 'PENDING',
      }
    }
    if (receipt.status === 'success') {
      return {
        status: 'COMPLETED',
        code: null,
        fromHash: fromHash,
        toHash: fromHash,
      }
    }
    return {
      status: 'REVERTED',
      code: '99',
      message: 'Transaction reverted.',
      fromHash: fromHash,
      toHash: fromHash,
    }
  } else {
    // bridge case
    return await getBridgeStatus(
      trade.aggregator as any,
      {
        fromChainId: trade.inputAmount.currency.chainId,
        toChainId: trade.outputAmount.currency.chainId,
        fromHash,
      } as any,
      trade.crossChainParams
    )
  }
}

async function trackTradeCompletion(
  srcHash: string,
  trade: GenericTrade,
  onDone: (hashes: { src?: string; dst?: string; completed?: boolean }) => void
) {
  if (!trade) {
    onDone({ src: srcHash })
    return
  }

  try {
    const maxAttempts = 60
    const delayMs = 5000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await getStatusFromTrade(srcHash, trade)
        const statusAny = status as any
        const statusInfo = statusAny?.statusInfo
        const bridgeStatus = (statusInfo?.status || statusAny?.status) as string | undefined

        if (status?.toHash) {
          onDone({ src: srcHash, dst: status.toHash, completed: true })
          return
        }

        if (bridgeStatus === 'DONE' || bridgeStatus === 'COMPLETED') {
          onDone({ src: srcHash, completed: true })
          return
        }

        if (status?.code) {
          const errorCode = status.code
          const errorMessage = status?.message || 'Bridge transaction failed'
          console.error('Bridge failed:', errorCode, errorMessage)
          onDone({ src: srcHash })
          return
        }

        if (
          bridgeStatus === 'FAILED' ||
          bridgeStatus === 'TRANSFER_REFUNDED' ||
          bridgeStatus === 'INVALID' ||
          bridgeStatus === 'REVERTED'
        ) {
          const errorCode = bridgeStatus
          const errorMessage =
            statusInfo?.message ||
            statusAny?.message ||
            statusAny?.error ||
            'Bridge transaction failed'
          console.error('Bridge failed:', errorCode, errorMessage)
          onDone({ src: srcHash })
          return
        }
      } catch (err) {
        console.debug('Error checking bridge status:', err)
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    console.warn('Bridge status check timeout, invalidating source chain balances only')
    onDone({ src: srcHash })
  } catch (err) {
    console.error('Error tracking bridge completion:', err)
    onDone({ src: srcHash })
  }
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
  actionCalls?: ActionCall[]
  quoting?: boolean
}
type TradeState = {
  srcHash?: string
  dstHash?: string
  confirmed: boolean
  bridgeComplete: boolean
  bridgeTracking: boolean
  bridgeTrackingStopped: boolean
}

const initialTradeState: TradeState = {
  srcHash: undefined,
  dstHash: undefined,
  confirmed: false,
  bridgeComplete: false,
  bridgeTracking: false,
  bridgeTrackingStopped: false,
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
    actionCalls: destinationCalls,
    quoting,
  } = props

  const { address, isConnected } = useConnection()
  const { switchChain } = useSwitchChain()
  const { sendTransactionAsync, isPending } = useSendTransaction()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const toast = useToast()
  const { createEntry, updateEntry } = useTxHistory()

  const historyIdRef = useRef<string | null>(null)

  // 🔹 Keep UI step separate
  const [step, setStep] = useState<
    'idle' | 'approving' | 'signing' | 'broadcast' | 'confirmed' | 'error'
  >('idle')

  // 🔹 All trade-related state in one place
  const [tradeState, setTradeState] = useState<TradeState>(initialTradeState)

  const { srcHash, dstHash, confirmed, bridgeComplete, bridgeTracking, bridgeTrackingStopped } =
    tradeState

  /** Helper to update the trade state */
  const updateTradeState = (patch: Partial<TradeState>) =>
    setTradeState((prev) => ({ ...prev, ...patch }))

  const srcChainId = useMemo(() => srcCurrency?.chainId, [srcCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId, [dstCurrency])
  const srcTokenAddress = useMemo(
    () => srcCurrency?.address?.toLowerCase() as Address | undefined,
    [srcCurrency]
  )

  useEffect(() => {
    if (step === 'error' && !srcHash) {
      setStep('idle')
    }
  }, [trade, step, srcHash])

  const isBridge = useMemo(() => {
    return Boolean(srcChainId && dstChainId && srcChainId !== dstChainId)
  }, [srcChainId, dstChainId])

  const spender = trade ? (trade as any).approvalTarget || (trade as any).target : undefined
  const skipApprove = trade ? (trade as any).skipApprove || false : false

  const { data: currentAllowance } = useReadContract({
    address: srcTokenAddress && srcTokenAddress !== zeroAddress ? srcTokenAddress : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && spender ? [address, spender] : undefined,
    query: {
      enabled: Boolean(
        srcTokenAddress && address && spender && srcTokenAddress !== zeroAddress && !skipApprove
      ),
    },
  })

  const needsApproval = useMemo(() => {
    if (!srcTokenAddress || srcTokenAddress === zeroAddress || !spender || skipApprove) {
      return false
    }
    if (!amountWei) return false
    if (currentAllowance === undefined) return true
    const requiredAmount = BigInt(amountWei)
    return currentAllowance < requiredAmount
  }, [srcTokenAddress, spender, amountWei, currentAllowance, skipApprove])

  /** Reset callback */
  const resetCallback = useCallback(() => {
    setStep('idle')
    setTradeState(initialTradeState)
    onReset?.()
  }, [onReset])

  useEffect(() => {
    const showReset = Boolean(confirmed && srcHash)
    if (onResetStateChange) {
      requestAnimationFrame(() => {
        onResetStateChange(showReset, showReset ? resetCallback : undefined)
      })
    }
  }, [confirmed, srcHash, onResetStateChange])

  /** Compute approvals and other helpers omitted for brevity... */

  const execute = useCallback(async () => {
    if (!address || !srcChainId || !trade) {
      toast.showError('Missing required parameters')
      return
    }

    onTransactionStart?.()

    try {
      switchChain({ chainId: Number(srcChainId) })

      /** --- APPROVE --- */
      if (needsApproval && srcTokenAddress && amountWei && spender) {
        setStep('approving')
        const approvalHash = await writeContractAsync({
          address: srcTokenAddress,
          abi: erc20Abi as any,
          functionName: 'approve',
          args: [spender as Address, BigInt(amountWei)],
        })

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approvalHash as any })
        }
      }

      /** --- SIGN & BROADCAST --- */
      setStep('signing')
      const txData = await getTransactionData(trade)
      if (!txData?.to || !txData.calldata) {
        throw new Error('Failed to get transaction data from trade')
      }

      setStep('broadcast')

      const hash = await sendTransactionAsync({
        to: txData.to as Address,
        data: txData.calldata,
        value: txData.value ? BigInt(txData.value.toString()) : 0n,
      })

      updateTradeState({ srcHash: hash })
      setStep('confirmed')

      const type =
        isBridge && destinationCalls && destinationCalls.length > 0
          ? 'bridge_with_actions'
          : isBridge
            ? 'bridge'
            : 'swap'

      if (!historyIdRef.current) {
        historyIdRef.current = createEntry({
          type: type as any,
          srcChainId,
          dstChainId,
          srcHash: hash,
          dstHash: undefined,
          hasDestinationActions: Boolean(destinationCalls && destinationCalls.length > 0),
          status: 'pending',
        })
      } else {
        updateEntry(historyIdRef.current, {
          srcChainId,
          dstChainId,
          srcHash: hash,
          hasDestinationActions: Boolean(destinationCalls && destinationCalls.length > 0),
          status: 'pending',
        })
      }

      /** --- WAIT FOR RECEIPT --- */
      if (!publicClient) throw new Error('No public client')

      publicClient
        .waitForTransactionReceipt({ hash })
        .then(() => {
          updateTradeState({ confirmed: true })

          /** On bridge start */

          if (!isBridge) {
            if (historyIdRef.current)
              updateEntry(historyIdRef.current, {
                status: 'completed',
              })
          } else if (trade.crossChainParams) {
            updateTradeState({ bridgeTracking: true, bridgeTrackingStopped: false })

            trackTradeCompletion(hash, trade, (hashes) => {
              updateTradeState({
                bridgeTracking: false,
                bridgeTrackingStopped: true,
                dstHash: hashes.dst,
                bridgeComplete: Boolean(hashes.dst || hashes.completed),
              })
              if (historyIdRef.current) {
                updateEntry(historyIdRef.current, {
                  dstHash: hashes.dst || undefined,
                  status: hashes.dst || hashes.completed ? 'completed' : 'failed',
                })
              }
              onTransactionEnd?.()
              onDone(hashes)
            })
          } else {
            onTransactionEnd?.()
            onDone({ src: hash })
          }
        })
        .catch((err) => console.error('Error waiting for transaction receipt:', err))
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : 'Transaction failed')

      updateEntry(historyIdRef.current!, { status: 'failed' })
      onTransactionEnd?.()
      setStep('idle')

      console.error('Execution error:', err)
    }
  }, [
    address,
    srcChainId,
    trade,
    getTransactionData,
    needsApproval,
    spender,
    srcTokenAddress,
    amountWei,
    writeContractAsync,
    sendTransactionAsync,
    publicClient,
    onDone,
    onTransactionStart,
    onTransactionEnd,
    createEntry,
  ])

  const shouldShow = (name: 'approving' | 'signing' | 'broadcast' | 'confirmed') => {
    const order = ['approving', 'signing', 'broadcast', 'confirmed']
    const currentIdx = order.indexOf(step as any)
    const idx = order.indexOf(name)
    if (step === 'error') return true
    if (step === 'idle') return false
    return idx <= currentIdx
  }

  return (
    <div className="space-y-3">
      {(step === 'idle' || step === 'error') && (
        <>
          {!isConnected ? (
            <div className="w-full flex justify-center">
              <WalletConnect />
            </div>
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
            <button className="btn btn-primary w-full" onClick={execute} disabled={isPending}>
              {isBridge ? 'Bridge' : 'Swap'}
            </button>
          )}
        </>
      )}
      {step !== 'idle' && !srcHash && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {needsApproval && shouldShow('approving') && (
              <Step
                label="Approve token"
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
