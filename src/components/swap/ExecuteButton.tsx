import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Address, Hex } from 'viem'
import { zeroAddress } from 'viem'
import { useSendTransaction, useWriteContract, usePublicClient, useReadContract, useConnection, useSwitchChain } from 'wagmi'
import type { GenericTrade } from '../../sdk/types'
import { SupportedChainId } from '../../sdk/types'
import { buildTransactionUrl } from '../../lib/explorer'
import { ERC20_ABI } from '../../lib/abi'
import type { DestinationCall } from '../../lib/types/destinationAction'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { useToast } from '../common/ToastHost'
import { WalletConnect } from '../connect'
import { useTxHistory } from '../../contexts/TxHistoryContext'
import type { RawCurrency } from '../../types/currency'

type StepStatus = 'idle' | 'active' | 'done' | 'error'

function Step({ label, status }: { label: string; status: StepStatus }) {
  const icon = status === 'done' ? '✅' : status === 'error' ? '❌' : status === 'active' ? '⏳' : '•'
  const cls = status === 'error' ? 'text-error' : status === 'done' ? 'text-success' : status === 'active' ? 'text-warning' : ''
  return (
    <div className={`flex items-center gap-1 ${cls}`}>
      <span>{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

async function trackBridgeCompletion(
  trade: GenericTrade,
  srcChainId: string,
  dstChainId: string,
  srcHash: string,
  onDone: (hashes: { src?: string; dst?: string; completed?: boolean }) => void,
) {
  if (!trade.crossChainParams) {
    onDone({ src: srcHash })
    return
  }

  try {
    const { getBridgeStatus } = await import('@1delta/trade-sdk')
    const { Bridge } = await import('@1delta/bridge-configs')

    const bridgeName = Object.values(Bridge).find((b) => b.toString() === trade.aggregator.toString()) || (trade.aggregator as any)

    const maxAttempts = 60
    const delayMs = 5000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await getBridgeStatus(
          bridgeName as any,
          {
            fromChainId: srcChainId,
            toChainId: dstChainId,
            fromHash: srcHash,
          } as any,
          trade.crossChainParams,
        )

        const statusAny = status as any
        const statusInfo = statusAny?.statusInfo
        const bridgeStatus = (statusInfo?.status || statusAny?.status) as string | undefined

        console.debug('Bridge status poll result:', { srcHash, status })

        if (status?.toHash) {
          console.debug('Bridge completed:', { srcHash, dstHash: status.toHash })
          onDone({ src: srcHash, dst: status.toHash, completed: true })
          return
        }

        if (bridgeStatus === 'DONE' || bridgeStatus === 'COMPLETED') {
          console.debug('Bridge completed without destination hash:', { srcHash, status })
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

        if (bridgeStatus === 'FAILED' || bridgeStatus === 'TRANSFER_REFUNDED' || bridgeStatus === 'INVALID' || bridgeStatus === 'REVERTED') {
          const errorCode = bridgeStatus
          const errorMessage = statusInfo?.message || statusAny?.message || statusAny?.error || 'Bridge transaction failed'
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
  destinationCalls?: DestinationCall[]
  quoting?: boolean
}

export default function ExecuteButton({
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
  destinationCalls,
  quoting,
}: ExecuteButtonProps) {
  const { address } = useConnection()
  const { isConnected } = useConnection()
  const { switchChain } = useSwitchChain()
  const [step, setStep] = useState<'idle' | 'approving' | 'signing' | 'broadcast' | 'confirmed' | 'error'>('idle')
  const [srcHash, setSrcHash] = useState<string | undefined>()
  const [dstHash, setDstHash] = useState<string | undefined>()
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isBridgeComplete, setIsBridgeComplete] = useState(false)
  const [isBridgeTracking, setIsBridgeTracking] = useState(false)
  const [bridgeTrackingStopped, setBridgeTrackingStopped] = useState(false)
  const { sendTransactionAsync, isPending } = useSendTransaction()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const toast = useToast()
  const { createEntry, updateEntry } = useTxHistory()
  const historyIdRef = useRef<string | null>(null)

  const srcChainId = useMemo(() => srcCurrency?.chainId, [srcCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId, [dstCurrency])
  const srcToken = useMemo(() => srcCurrency?.address as Address | undefined, [srcCurrency])

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
    address: srcToken && srcToken.toLowerCase() !== zeroAddress.toLowerCase() ? srcToken : undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && spender ? [address, spender] : undefined,
    query: {
      enabled: Boolean(srcToken && address && spender && srcToken.toLowerCase() !== zeroAddress.toLowerCase() && !skipApprove),
    },
  })

  const needsApproval = useMemo(() => {
    if (!srcToken || srcToken.toLowerCase() === zeroAddress.toLowerCase() || !spender || skipApprove) {
      return false
    }
    if (!amountWei) return false
    if (currentAllowance === undefined) return true
    const requiredAmount = BigInt(amountWei)
    return currentAllowance < requiredAmount
  }, [srcToken, spender, amountWei, currentAllowance, skipApprove])

  const resetCallback = useCallback(() => {
    setStep('idle')
    setSrcHash(undefined)
    setDstHash(undefined)
    setIsConfirmed(false)
    setIsBridgeComplete(false)
    setIsBridgeTracking(false)
    setBridgeTrackingStopped(false)
    onReset?.()
  }, [onReset])

  useEffect(() => {
    const showReset = Boolean(isConfirmed && srcHash)
    if (onResetStateChange) {
      requestAnimationFrame(() => {
        onResetStateChange(showReset, showReset && onReset ? resetCallback : undefined)
      })
    }
  }, [isConfirmed, srcHash, onReset, onResetStateChange, resetCallback])

  // Extract transaction data from trade
  const getTransactionData = useCallback(async () => {
    if (!trade) return null

    if ('assemble' in trade && typeof (trade as any).assemble === 'function') {
      const assembled = await (trade as any).assemble()
      if (assembled && 'EVM' in assembled && (assembled as any).EVM) {
        return (assembled as any).EVM
      }
    }

    if ('transaction' in trade && (trade as any).transaction) {
      const tx = (trade as any).transaction
      const calldata = (tx as any).calldata ?? (tx as any).data
      if (tx && calldata && (tx as any).to) {
        return {
          to: (tx as any).to,
          calldata,
          value: (tx as any).value ?? 0n,
        }
      }
    }

    if ((trade as any).target && ((trade as any).calldata || (trade as any).data)) {
      const calldata = (trade as any).calldata ?? (trade as any).data
      return {
        to: (trade as any).target,
        calldata,
        value: (trade as any).value ?? 0n,
      }
    }

    return null
  }, [trade])

  const execute = useCallback(async () => {
    if (!address || !srcChainId || !trade) {
      toast.showError('Missing required parameters')
      return
    }

    try {
      const srcChainIdNum = Number(srcChainId)
      switchChain({ chainId: srcChainIdNum })

      let approvalHash: Address | undefined

      if (
        needsApproval &&
        srcToken &&
        amountWei &&
        spender &&
        !(srcChainId === SupportedChainId.MOONBEAM && dstChainId === SupportedChainId.MOONBEAM)
      ) {
        setStep('approving')
        approvalHash = await writeContractAsync({
          address: srcToken,
          abi: ERC20_ABI as any,
          functionName: 'approve',
          args: [spender as Address, BigInt(amountWei)],
        })
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approvalHash as any })
        }
      }

      onTransactionStart?.()

      setStep('signing')
      const txData = await getTransactionData()
      if (!txData || !txData.calldata || !txData.to) {
        throw new Error('Failed to get transaction data from trade')
      }

      const tradeDestinationCalls =
        (trade as any).additionalCalls || (trade as any).destinationCalls || (trade as any).crossChainParams?.additionalCalls
      console.debug('=== Destination Calls Debug ===')
      console.debug('Destination calls from prop:', destinationCalls)
      console.debug('Destination calls from trade object:', tradeDestinationCalls)
      console.debug('Trade object keys:', Object.keys(trade || {}))
      console.debug('Trade crossChainParams:', (trade as any).crossChainParams)
      console.debug('Is bridge:', isBridge)
      console.debug('Source chain:', srcChainId)
      console.debug('Destination chain:', dstChainId)
      console.debug('================================')

      let hash: Address
      setStep('broadcast')
      hash = await sendTransactionAsync({
        to: txData.to as Address,
        data: txData.calldata as Hex,
        value: txData.value ? BigInt(txData.value.toString()) : BigInt(0),
      })
      setSrcHash(hash)
      setStep('confirmed')

      const type = isBridge && destinationCalls && destinationCalls.length > 0 ? 'bridge_with_actions' : isBridge ? 'bridge' : 'swap'

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

      // Wait for confirmation asynchronously
      if (publicClient) {
        publicClient
          .waitForTransactionReceipt({ hash: hash as any })
          .then(async () => {
            setIsConfirmed(true)

            if (historyIdRef.current && !isBridge) {
              updateEntry(historyIdRef.current, {
                status: 'completed',
              })
            }

            if (isBridge && trade?.crossChainParams) {
              const bridgeDestinationCalls = (trade as any).crossChainParams?.additionalCalls || (trade as any).additionalCalls
              console.debug('=== Bridge Transaction with Destination Calls ===')
              console.debug('Bridge destination calls from trade:', bridgeDestinationCalls)
              console.debug('Cross chain params:', trade.crossChainParams)
              console.debug('================================================')
              setIsBridgeTracking(true)
              setBridgeTrackingStopped(false)
              trackBridgeCompletion(trade, srcChainId!, dstChainId!, hash, (hashes) => {
                setIsBridgeTracking(false)
                setBridgeTrackingStopped(true)
                if (hashes.dst) {
                  setDstHash(hashes.dst)
                }
                if (hashes.dst || hashes.completed) {
                  setIsBridgeComplete(true)
                }
                if (historyIdRef.current) {
                  updateEntry(historyIdRef.current, {
                    dstHash: hashes.dst || undefined,
                    status: hashes.dst || hashes.completed ? 'completed' : 'failed',
                  })
                }
                onDone(hashes)
              })
            } else if (
              !isBridge &&
              srcChainId === SupportedChainId.MOONBEAM &&
              dstChainId === SupportedChainId.MOONBEAM &&
              destinationCalls &&
              destinationCalls.length > 0 &&
              address
            ) {
              try {
                console.debug('=== Executing Destination Calls ===')
                console.debug('Number of destination calls:', destinationCalls.length)
                console.debug('Destination calls to execute:', destinationCalls)
                for (const call of destinationCalls) {
                  console.debug('Executing destination call:', {
                    target: call.target,
                    calldata: call.calldata,
                    value: call.value?.toString(),
                    gasLimit: call.gasLimit?.toString(),
                  })
                  await sendTransactionAsync({
                    to: call.target,
                    data: call.calldata,
                    value: (call.value ?? 0n) as any,
                  })
                }
                console.debug('All destination calls executed successfully')
                console.debug('=====================================')
                onDone({ src: hash })
              } catch (e) {
                console.error('Destination actions execution failed:', e)
                toast.showError('Failed to execute destination actions')
                onDone({ src: hash })
              }
            } else {
              onDone({ src: hash })
            }
          })
          .catch((err) => {
            console.error('Error waiting for transaction receipt:', err)
          })
      } else {
        onDone({ src: hash })

        if (historyIdRef.current && !isBridge) {
          updateEntry(historyIdRef.current, {
            status: 'completed',
          })
        }

        if (isBridge && trade?.crossChainParams) {
          const bridgeDestinationCalls = (trade as any).crossChainParams?.additionalCalls || (trade as any).additionalCalls
          console.debug('=== Bridge Transaction with Destination Calls (no publicClient) ===')
          console.debug('Bridge destination calls from trade:', bridgeDestinationCalls)
          console.debug('Cross chain params:', trade.crossChainParams)
          console.debug('================================================================')
          setIsBridgeTracking(true)
          setBridgeTrackingStopped(false)
          trackBridgeCompletion(trade, srcChainId!, dstChainId!, hash, (hashes) => {
            setIsBridgeTracking(false)
            setBridgeTrackingStopped(true)
            if (hashes.dst) {
              setDstHash(hashes.dst)
            }
            if (hashes.dst || hashes.completed) {
              setIsBridgeComplete(true)
            }
            if (historyIdRef.current) {
              updateEntry(historyIdRef.current, {
                dstHash: hashes.dst || undefined,
                status: hashes.dst || hashes.completed ? 'completed' : 'failed',
              })
            }
            onDone(hashes)
          })
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed'
      toast.showError(errorMessage)
      if (historyIdRef.current) {
        updateEntry(historyIdRef.current, {
          status: 'failed',
        })
      }
      onTransactionEnd?.()
      setStep('idle')
      console.error('Execution error:', err)
    }
  }, [
    needsApproval,
    srcToken,
    amountWei,
    spender,
    address,
    srcChainId,
    dstChainId,
    destinationCalls,
    destinationCalls,
    writeContractAsync,
    getTransactionData,
    sendTransactionAsync,
    publicClient,
    onDone,
    onTransactionStart,
    onTransactionEnd,
    isBridge,
    trade,
    createEntry,
    updateEntry,
    srcChainId,
    switchChain,
    toast,
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
              <Step label="Approve token" status={step === 'approving' ? 'active' : step === 'error' ? 'error' : 'done'} />
            )}
            {shouldShow('signing') && (
              <Step
                label={isBridge ? 'Prepare bridge' : 'Prepare swap'}
                status={step === 'signing' ? 'active' : step === 'error' ? 'error' : step === 'confirmed' ? 'done' : 'idle'}
              />
            )}
            {shouldShow('broadcast') && (
              <Step label="Send tx" status={step === 'broadcast' ? 'active' : step === 'error' ? 'error' : step === 'confirmed' ? 'done' : 'idle'} />
            )}
            {shouldShow('confirmed') && <Step label="Confirmed" status={step === 'confirmed' ? 'done' : step === 'error' ? 'error' : 'idle'} />}
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
            {isConfirmed ? <span className="text-success">✓</span> : <span className="loading loading-spinner loading-xs"></span>}
          </div>
        </div>
      )}
    </div>
  )
}
