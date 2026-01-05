import { useMemo, useEffect, useState } from 'react'
import { Address, erc20Abi } from 'viem'
import { Lender, getBestRpcsForChain } from '@1delta/lib-utils'
import { multicallRetryUniversal } from '@1delta/providers'
import {
  prepareLenderDebitMulticall,
  parseLenderDebitResult,
  getLenderApproveTransaction,
  LendingMode,
  type LenderDebitData,
  getComposerAddress,
} from '@1delta/calldata-sdk'
import type { ActionCall } from '../../actions/shared/types'
import { extractLendingApprovals } from '../utils/extractMTokenApprovals'
import {
  getUnderlyingTokenFromLendingToken as getUnderlyingToken,
  calculateRequiredLendingTokenAmount,
} from '../utils/lenderUtils'

export interface LendingApprovalInfo {
  lender: Lender
  token: Address
  spender: Address
  balance: bigint
  requiredAmount: bigint
  needsApproval: boolean
  approvalTransaction?: ReturnType<typeof getLenderApproveTransaction>
}

export interface LendingApprovalsResult {
  approvals: LendingApprovalInfo[]
  needsAnyApproval: boolean
  lenderDebitData: Record<string, LenderDebitData>
}

export function useLendingApprovals(
  account: Address | undefined,
  inputCalls: ActionCall[] | undefined,
  chainId: string | undefined
): LendingApprovalsResult {
  const lendingApprovals = useMemo(() => {
    if (!inputCalls || !chainId || !account) return []
    const composerAddress = getComposerAddress(chainId)
    return extractLendingApprovals(inputCalls, composerAddress)
  }, [inputCalls, chainId, account])

  const lendersByToken = useMemo(() => {
    const map: Record<string, { lender: Lender; underlyingTokens: Address[] }> = {}

    for (const approval of lendingApprovals) {
      const key = String(approval.lender)
      if (!map[key]) {
        map[key] = { lender: approval.lender, underlyingTokens: [] }
      }

      try {
        const underlyingToken = getUnderlyingToken(
          approval.lender,
          approval.token,
          approval.underlyingTokenAddress
        )

        if (underlyingToken && !map[key].underlyingTokens.includes(underlyingToken)) {
          map[key].underlyingTokens.push(underlyingToken)
        }
      } catch (error) {
        console.error('Failed to get underlying token:', error)
      }
    }

    return Object.values(map)
  }, [lendingApprovals])

  const prepared = useMemo(() => {
    if (!account || !chainId || lendersByToken.length === 0) {
      return null
    }

    const lenders: Lender[] = []
    const tokenAddressesByLender: Record<Lender, Address[]> = {} as any

    for (const { lender, underlyingTokens } of lendersByToken) {
      lenders.push(lender)
      tokenAddressesByLender[lender] = underlyingTokens
    }

    const composerAddress = getComposerAddress(chainId)

    return prepareLenderDebitMulticall({
      chainId,
      account,
      subAccount: account,
      lenders,
      tokenAddressesByLender,
      spender: composerAddress,
    })
  }, [account, chainId, lendersByToken])

  const [lenderDebitResults, setLenderDebitResults] = useState<any[] | null>(null)
  const [balanceAndAllowanceResults, setBalanceAndAllowanceResults] = useState<any[] | null>(null)

  useEffect(() => {
    if (!chainId) {
      setLenderDebitResults(null)
      setBalanceAndAllowanceResults(null)
      return
    }

    const fetchAllData = async () => {
      const rpcFromRpcSelector = await getBestRpcsForChain(chainId)
      const overrides =
        rpcFromRpcSelector && rpcFromRpcSelector.length > 0
          ? { [chainId]: rpcFromRpcSelector }
          : undefined

      const promises: Promise<any>[] = []

      if (prepared) {
        promises.push(
          (async () => {
            try {
              const calls = prepared.calls.map((call) => ({
                address: call.address as Address,
                name: call.name as string,
                params: call.params as any[],
              }))

              const results = await multicallRetryUniversal({
                chain: chainId,
                calls,
                abi: prepared.abi as any,
                maxRetries: 3,
                providerId: 0,
                ...(overrides && { overrdies: overrides }),
              })

              setLenderDebitResults(results)
            } catch (error) {
              console.error('Failed to fetch lender debit data:', error)
              setLenderDebitResults(null)
            }
          })()
        )
      } else {
        setLenderDebitResults(null)
      }

      if (account && lendingApprovals.length > 0) {
        promises.push(
          (async () => {
            try {
              const calls = lendingApprovals.flatMap((approval) => [
                {
                  address: approval.token,
                  name: 'balanceOf' as const,
                  params: [account],
                },
                {
                  address: approval.token,
                  name: 'allowance' as const,
                  params: [account, approval.spender],
                },
              ])

              const results = await multicallRetryUniversal({
                chain: chainId,
                calls,
                abi: erc20Abi,
                maxRetries: 3,
                providerId: 0,
                ...(overrides && { overrdies: overrides }),
              })

              setBalanceAndAllowanceResults(results)
            } catch (error) {
              console.error('Failed to fetch balance and allowance:', error)
              setBalanceAndAllowanceResults(null)
            }
          })()
        )
      } else {
        setBalanceAndAllowanceResults(null)
      }

      await Promise.all(promises)
    }

    fetchAllData()
  }, [prepared, account, chainId, lendingApprovals])

  const lenderDebitData = useMemo(() => {
    if (!prepared || !lenderDebitResults) {
      return {}
    }

    return parseLenderDebitResult({
      metadata: prepared.meta.metadata,
      raw: lenderDebitResults,
      chainId: prepared.meta.chainId,
    })
  }, [prepared, lenderDebitResults])

  const approvalInfos = useMemo(() => {
    if (lendingApprovals.length === 0) {
      return []
    }

    const composerAddress = getComposerAddress(chainId || '')

    return lendingApprovals.map((approval, index) => {
      const balanceIndex = index * 2
      const allowanceIndex = index * 2 + 1
      const balance = (balanceAndAllowanceResults?.[balanceIndex] as bigint) || 0n
      const currentAllowance = (balanceAndAllowanceResults?.[allowanceIndex] as bigint) || 0n
      const lenderKey = String(approval.lender)
      const debitData = lenderDebitData[lenderKey]
      const hasDelegation = debitData
        ? Object.values(debitData).some(
            (entry) => entry && (entry.amount !== undefined || entry.params !== undefined)
          )
        : false

      let requiredAmount = balance

      if (approval.underlyingAmount && approval.underlyingAmount > 0n) {
        try {
          const calculatedAmount = calculateRequiredLendingTokenAmount(
            approval.lender,
            approval.underlyingAmount,
            approval.token,
            balance
          )
          if (calculatedAmount !== null) {
            requiredAmount = calculatedAmount
          }
        } catch (error) {
          console.error('Failed to calculate required amount:', error)
        }
      }

      const hasSufficientAllowance = currentAllowance >= requiredAmount
      const needsApproval = requiredAmount > 0n && !hasDelegation && !hasSufficientAllowance

      let approvalTransaction: ReturnType<typeof getLenderApproveTransaction> | undefined

      if (needsApproval && chainId && account) {
        try {
          approvalTransaction = getLenderApproveTransaction(
            chainId,
            account,
            String(approval.lender),
            approval.token,
            composerAddress,
            LendingMode.NONE,
            requiredAmount
          )
        } catch (error) {
          approvalTransaction = undefined
        }
      }

      return {
        lender: approval.lender,
        token: approval.token,
        spender: approval.spender,
        balance,
        requiredAmount,
        needsApproval,
        approvalTransaction,
      }
    })
  }, [lendingApprovals, lenderDebitData, chainId, account, balanceAndAllowanceResults])

  const needsAnyApproval = useMemo(
    () => approvalInfos.some((info) => info.needsApproval),
    [approvalInfos]
  )

  return {
    approvals: approvalInfos,
    needsAnyApproval,
    lenderDebitData,
  }
}
