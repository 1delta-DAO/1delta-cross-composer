import { useMemo } from 'react'
import { Address, erc20Abi, zeroAddress } from 'viem'
import { useReadContracts } from 'wagmi'
import type { ActionCall } from '../../actions/shared/types'
import { extractMTokenApprovals } from '../utils/extractMTokenApprovals'
import { getComposerAddress } from '@1delta/calldata-sdk'

export interface MTokenApprovalInfo {
  token: Address
  spender: Address
  balance: bigint
  currentAllowance: bigint
  needsApproval: boolean
}

export function useMTokenApprovals(
  account: Address | undefined,
  inputCalls: ActionCall[] | undefined,
  chainId: string | undefined
): { approvals: MTokenApprovalInfo[]; needsAnyApproval: boolean } {
  const approvals = useMemo(() => {
    if (!inputCalls || !chainId || !account) return []
    const composerAddress = getComposerAddress(chainId)
    return extractMTokenApprovals(inputCalls, composerAddress)
  }, [inputCalls, chainId, account])

  const contracts = useMemo(() => {
    if (!account || approvals.length === 0) return []
    return approvals.flatMap((approval) => [
      {
        address: approval.token,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [account],
      },
      {
        address: approval.token,
        abi: erc20Abi,
        functionName: 'allowance' as const,
        args: [account, approval.spender],
      },
    ])
  }, [account, approvals])

  const { data: results } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
    },
  })

  const approvalInfos = useMemo(() => {
    if (!results || results.length === 0) {
      return approvals.map((approval) => ({
        ...approval,
        balance: 0n,
        currentAllowance: 0n,
        needsApproval: false,
      }))
    }

    return approvals.map((approval, index) => {
      const balanceIndex = index * 2
      const allowanceIndex = index * 2 + 1
      const balance = (results[balanceIndex]?.result as bigint) || 0n
      const currentAllowance = (results[allowanceIndex]?.result as bigint) || 0n
      const needsApproval = balance > 0n && currentAllowance < balance

      return {
        ...approval,
        balance,
        currentAllowance,
        needsApproval,
      }
    })
  }, [results, approvals])

  const needsAnyApproval = useMemo(
    () => approvalInfos.some((q) => q.needsApproval),
    [approvalInfos]
  )

  return {
    approvals: approvalInfos,
    needsAnyApproval,
  }
}
