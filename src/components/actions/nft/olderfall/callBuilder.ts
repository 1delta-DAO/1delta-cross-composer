import { encodeFunctionData, type Address } from "viem"
import type { DestinationCall } from "../../../../lib/types/destinationAction"
import { SEQUENCE_MARKET_ADDRESS } from "../../../../lib/sequence/market"
import { generateOlderfallBuySteps, type OlderfallListing } from "../../../../lib/sequence/marketplace"
import { ERC20_ABI } from "../../../../lib/abi"
import { DeltaCallType } from "@1delta/trade-sdk/dist/types"
import type { DestinationCallBuilder } from "../../shared/types"

export type OlderfallCallBuilderParams = {
  chainId: string
  buyer: Address
  listing: OlderfallListing
}

export const buildCalls: DestinationCallBuilder<OlderfallCallBuilderParams> = async ({ chainId, buyer, listing }) => {
  const orderId = String(listing.orderId || "")
  const tokenId = String(listing.tokenId || "")
  const currency = String(listing.currency || "")
  const priceRaw = String(listing.pricePerToken || "")
  const collectionAddress = String(listing.tokenContract || "")

  if (!chainId || !buyer || !orderId || !tokenId || !currency || !priceRaw || !collectionAddress) {
    return []
  }

  const priceAmount = BigInt(priceRaw)

  const approveCalldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [SEQUENCE_MARKET_ADDRESS, priceAmount],
  })

  const approveCall: DestinationCall = {
    target: currency as Address,
    calldata: approveCalldata,
    value: 0n,
  }

  const steps = await generateOlderfallBuySteps({
    chainId,
    buyer,
    orderId,
    tokenId,
    quantity: "1",
    collectionAddress,
  })

  const sequenceCalls: DestinationCall[] = steps.map((step) => {
    const rawValue = step.value || ""
    const v = rawValue && rawValue !== "0" ? BigInt(rawValue) : 0n
    return {
      target: step.to as Address,
      calldata: step.data as `0x${string}`,
      value: v,
    }
  })

  const sweepCalldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [buyer, 0n],
  })

  const sweepCall: DestinationCall = {
    target: currency as Address,
    calldata: sweepCalldata,
    value: 0n,
    callType: DeltaCallType.FULL_TOKEN_BALANCE,
    tokenAddress: currency as Address,
    balanceOfInjectIndex: 1,
    gasLimit: 600000n,
  }

  return [approveCall, ...sequenceCalls, sweepCall]
}
