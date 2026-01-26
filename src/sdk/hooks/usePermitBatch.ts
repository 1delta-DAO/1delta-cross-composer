import { useState, useCallback } from 'react'
import { useAccount, useSignTypedData, useWriteContract, useChainId } from 'wagmi'
import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hex } from 'viem'
import { moonbeam } from 'viem/chains'
import { BATCH_PRECOMPILE, CALL_PERMIT_PRECOMPILE, DOMAIN_SEPARATOR } from '../../lib/consts'
import { BatchCall, PermitBatchParams } from '../../lib/types'
import { BATCH_ABI, CALL_PERMIT_ABI } from '../../lib/abi'
import { getRpcSelectorEvmClient } from '@1delta/lib-utils'
import { fetchDecimals as fetchDecimalsUtil } from '../utils/tokenUtils'

export function usePermitBatch() {
  const { address } = useAccount()
  const chainId = useChainId()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decimalsCache, setDecimalsCache] = useState<Record<Address, number>>({})
  const [loadingDecimals, setLoadingDecimals] = useState<Set<Address>>(new Set())

  const fetchNonce = useCallback(
    async (userAddress: Address, targetChainId?: number | string): Promise<bigint | null> => {
      try {
        const nonceChainId = targetChainId !== undefined ? String(targetChainId) : String(chainId)
        const publicClient = await getRpcSelectorEvmClient(nonceChainId)
        if (!publicClient) {
          console.error('Could not get public client for fetching nonce')
          return null
        }
        const nonce = await publicClient.readContract({
          address: CALL_PERMIT_PRECOMPILE,
          abi: CALL_PERMIT_ABI,
          functionName: 'nonces',
          args: [userAddress],
        })
        console.info('nonce fetch result:', nonce)
        return nonce
      } catch (error) {
        console.error('Error fetching nonce:', error)
        return null
      }
    },
    [chainId]
  )

  const { signTypedDataAsync } = useSignTypedData()
  const { writeContractAsync } = useWriteContract()

  const createBatchData = useCallback((calls: BatchCall[]): Hex => {
    const targets = calls.map((call) => call.target)
    const values = calls.map((call) => call.value)
    const callData = calls.map((call) => call.callData)
    const gasLimits = calls.map((call) => call.gasLimit)

    return encodeFunctionData({
      abi: BATCH_ABI,
      functionName: 'batchAll',
      args: [targets, values, callData, gasLimits],
    })
  }, [])

  const fetchDecimals = useCallback(
    async (tokenAddress: Address): Promise<number | null> => {
      return fetchDecimalsUtil(
        tokenAddress,
        String(chainId),
        decimalsCache,
        loadingDecimals,
        setDecimalsCache,
        setLoadingDecimals
      )
    },
    [chainId, decimalsCache, loadingDecimals]
  )

  const executeSelfTransmit = useCallback(
    async (params: PermitBatchParams): Promise<{ hash: Hex | null; error: string | null }> => {
      try {
        setIsLoading(true)
        setError(null)

        if (!address || !DOMAIN_SEPARATOR) {
          return {
            hash: null,
            error: 'Missing required data for self-transmit',
          }
        }

        console.info('Fetching nonce for self-transmit:', address)
        const currentNonce = await fetchNonce(address)
        if (currentNonce === null) {
          return {
            hash: null,
            error: 'Failed to fetch nonce for self-transmit',
          }
        }

        const batchData = createBatchData(params.calls)
        const gasLimit = BigInt(800000)

        const typedData = {
          domain: {
            name: 'Call Permit Precompile',
            version: '1',
            chainId: moonbeam.id,
            verifyingContract: CALL_PERMIT_PRECOMPILE,
          },
          types: {
            CallPermit: [
              { name: 'from', type: 'address' },
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
              { name: 'gaslimit', type: 'uint64' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'CallPermit' as const,
          message: {
            from: params.from,
            to: BATCH_PRECOMPILE,
            value: BigInt(0),
            data: batchData,
            gaslimit: gasLimit,
            nonce: currentNonce,
            deadline: params.deadline,
          },
        }

        const signature = await signTypedDataAsync(typedData)
        const sig = signature.slice(2)
        const r = `0x${sig.slice(0, 64)}` as Hex
        const s = `0x${sig.slice(64, 128)}` as Hex
        const v = parseInt(sig.slice(128, 130), 16)

        const hash = await writeContractAsync({
          address: CALL_PERMIT_PRECOMPILE,
          abi: CALL_PERMIT_ABI,
          functionName: 'dispatch',
          args: [
            params.from,
            BATCH_PRECOMPILE,
            BigInt(0),
            batchData,
            gasLimit,
            params.deadline,
            v,
            r,
            s,
          ],
        })

        return { hash, error: null }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to execute self-transmit transaction'
        setError(errorMessage)
        return { hash: null, error: errorMessage }
      } finally {
        setIsLoading(false)
      }
    },
    [address, DOMAIN_SEPARATOR, fetchNonce, createBatchData, signTypedDataAsync, writeContractAsync]
  )

  const createERC20Calls = useCallback(
    (
      operations: Array<{
        type: 'approve' | 'transfer'
        tokenAddress: Address
        to: Address
        amount: string
        decimals?: number
      }>
    ): BatchCall[] => {
      return operations.map((op) => {
        const amount = parseUnits(op.amount, op.decimals || 18)
        const callData = encodeFunctionData({
          abi: erc20Abi,
          functionName: op.type,
          args: [op.to, amount],
        })

        return {
          target: op.tokenAddress,
          value: BigInt(0),
          callData,
          gasLimit: BigInt(100000),
        }
      })
    },
    []
  )

  const createArbitraryCalls = useCallback(
    (
      operations: Array<{
        target: Address
        calldata?: string
        value?: string
      }>
    ): BatchCall[] => {
      return operations.map((op) => {
        const valueInWei = op.value ? parseUnits(op.value, 18) : BigInt(0)

        return {
          target: op.target,
          value: valueInWei,
          callData: (op.calldata as Hex) || '0x',
          gasLimit: BigInt(100000),
        }
      })
    },
    []
  )

  const createBatchCalls = useCallback(
    (
      operations: Array<{
        operationType: 'erc20' | 'arbitrary'
        type?: 'approve' | 'transfer'
        tokenAddress?: Address
        to?: Address
        amount?: string
        decimals?: number
        target?: Address
        calldata?: string
        value?: string
      }>
    ): BatchCall[] => {
      const erc20Ops = operations.filter((op) => op.operationType === 'erc20')
      const arbitraryOps = operations.filter((op) => op.operationType === 'arbitrary')

      const erc20Calls = createERC20Calls(erc20Ops as any)
      const arbitraryCalls = createArbitraryCalls(arbitraryOps as any)

      return [...erc20Calls, ...arbitraryCalls]
    },
    [createERC20Calls, createArbitraryCalls]
  )

  return {
    executeSelfTransmit,
    createERC20Calls,
    createArbitraryCalls,
    createBatchCalls,
    createBatchData,
    fetchDecimals,
    fetchNonce,
    decimalsCache,
    loadingDecimals,
    isLoading,
    error,
    domainSeparator: DOMAIN_SEPARATOR,
  }
}
