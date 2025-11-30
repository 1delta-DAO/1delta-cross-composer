import { encodeFunctionData, type Address } from 'viem'
import type { ActionCall } from '../../shared/types'
import { SEQUENCE_MARKET_ADDRESS } from './constants'
import { generateOlderfallBuySteps, type OlderfallListing } from './api'
import { erc20Abi } from 'viem'
import { DeltaCallType } from '@1delta/lib-utils'
import type { ActionCallBuilder } from '../../shared/types'

export type OlderfallCallBuilderParams = {
  chainId: string
  buyer: Address
  userAddress: Address
  listing: OlderfallListing
}

export const buildCalls: ActionCallBuilder<OlderfallCallBuilderParams> = async ({
  chainId,
  buyer,
  userAddress,
  listing,
}) => {
  const orderId = String(listing.orderId || '')
  const tokenId = String(listing.tokenId || '')
  const currency = String(listing.currency || '')
  const priceRaw = String(listing.pricePerToken || '')
  const collectionAddress = String(listing.tokenContract || '')

  if (!chainId || !buyer || !orderId || !tokenId || !currency || !priceRaw || !collectionAddress) {
    return []
  }

  const priceAmount = BigInt(priceRaw)

  const approveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [SEQUENCE_MARKET_ADDRESS, priceAmount],
  })

  const approveCall: ActionCall = {
    callType: DeltaCallType.DEFAULT,
    target: currency as Address,
    callData: approveCalldata,
    value: 0n,
  }

  const steps = await generateOlderfallBuySteps({
    chainId,
    buyer,
    orderId,
    tokenId,
    quantity: '1',
    collectionAddress,
  })

  const sequenceCalls: ActionCall[] = steps.map((step) => {
    const rawValue = step.value || ''
    const v = rawValue && rawValue !== '0' ? BigInt(rawValue) : 0n
    return {
      callType: DeltaCallType.DEFAULT,
      target: step.to as Address,
      callData: step.data as `0x${string}`,
      value: v,
    }
  })

  const sweepCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [userAddress, 0n],
  })

  const sweepCall: ActionCall = {
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    target: currency as Address,
    callData: sweepCalldata,
    value: 0n,
    tokenAddress: currency as Address,
    balanceOfInjectIndex: 1,
    gasLimit: 600000n,
  }

  return [approveCall, ...sequenceCalls, sweepCall]
}
