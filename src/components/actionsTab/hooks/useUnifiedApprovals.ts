import { useMemo } from 'react'
import { Address } from 'viem'
import { useReadContracts } from 'wagmi'
import {
  prepareDebitDataMulticall,
  parseDebitDataResult,
  type DebitData,
} from '@1delta/calldata-sdk'

export interface ApprovalCheck {
  token: Address
  spender: Address
  amount?: bigint | string
}

export interface UnifiedApprovalResult {
  debitData: Record<string, DebitData>
  needsApproval: (token: Address, spender: Address) => boolean
  getAllowance: (token: Address, spender: Address) => bigint
  needsAnyApproval: boolean
}

export function useUnifiedApprovals(
  account: Address | undefined,
  chainId: string | undefined,
  toBeChecked: ApprovalCheck[],
  skip = false
): UnifiedApprovalResult {
  const prepared = useMemo(() => {
    if (!account || !chainId || toBeChecked.length === 0 || skip) {
      return null
    }

    const tokenAddresses = toBeChecked.map((a) => a.token)
    const spenders = toBeChecked.map((a) => a.spender)

    return prepareDebitDataMulticall({
      chainId,
      tokenAddresses,
      account,
      spenders,
    })
  }, [account, chainId, toBeChecked, skip])

  const contracts = useMemo(() => {
    if (!prepared) return []
    return prepared.calls.map((call) => ({
      address: call.address as Address,
      abi: prepared.abi,
      functionName: call.name as any,
      args: call.params as any[],
    }))
  }, [prepared])

  const { data: results } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0 && !skip,
    },
  })

  const debitData = useMemo(() => {
    if (!prepared || !results) {
      return {}
    }

    const rawResults = results.map((r) => r.result ?? '0x')

    try {
      return parseDebitDataResult({
        raw: rawResults,
        tokenAddresses: prepared.meta.tokenAddresses,
        spenders: prepared.meta.spenders,
      })
    } catch (error) {
      console.error('parseDebitDataResult error:', error, {
        rawResults,
        tokenAddresses: prepared.meta?.tokenAddresses,
        spenders: prepared.meta?.spenders,
      })
      return {}
    }
  }, [prepared, results])

  const needsApproval = useMemo(
    () => (token: Address, spender: Address) => {
      const key = token.toLowerCase()
      const data = debitData[key]
      if (!data) return false

      const allowance = data.allowances[spender.toLowerCase()] || 0n
      const approval = toBeChecked.find(
        (a) => a.token.toLowerCase() === key && a.spender.toLowerCase() === spender.toLowerCase()
      )

      if (!approval || !approval.amount) return false
      const requiredAmount = BigInt(approval.amount)
      return allowance < requiredAmount
    },
    [debitData, toBeChecked]
  )

  const getAllowance = useMemo(
    () => (token: Address, spender: Address) => {
      const key = token.toLowerCase()
      const data = debitData[key]
      if (!data) return 0n
      return data.allowances[spender.toLowerCase()] || 0n
    },
    [debitData]
  )

  const needsAnyApproval = useMemo(() => {
    return toBeChecked.some((approval) => {
      if (!approval.amount) return false
      return needsApproval(approval.token, approval.spender)
    })
  }, [toBeChecked, needsApproval])

  return {
    debitData,
    needsApproval,
    getAllowance,
    needsAnyApproval,
  }
}
