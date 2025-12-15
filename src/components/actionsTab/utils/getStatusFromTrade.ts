import { GenericTrade, getViemProvider } from '@1delta/lib-utils'
import { BridgeStatus, getBridgeStatus } from '@1delta/trade-sdk'
import { PublicClient } from 'viem'
import { isBridge } from './isBridge'

/**
 * Provide a current status from a trade
 * @param fromHash tx hash on source chain
 * @param trade trade object
 * @returns status object
 */
export async function getStatusFromTrade(
  fromHash: string,
  trade: GenericTrade,
  publicClient?: PublicClient
): Promise<{
  fromHash?: string | undefined
  toHash?: string | undefined
  // status: BridgeStatus
  message?: string
  statusInfo: {
    status: BridgeStatus
    message?: string
    bridgeResponseResult?: any
  }
} | null> {
  // same chain case
  if (!isBridge(trade)) {
    const provider =
      publicClient ?? (await getViemProvider({ chainId: trade.inputAmount.currency.chainId }))
    const receipt = await provider
      ?.getTransactionReceipt({ hash: fromHash as any })
      .catch(() => null)

    if (!receipt) {
      return {
        fromHash: fromHash,
        toHash: fromHash,
        statusInfo: {
          status: 'PENDING',
        },
      }
    }
    if (receipt.status === 'success') {
      return {
        fromHash: fromHash,
        toHash: fromHash,
        statusInfo: {
          status: 'DONE',
        },
      }
    }
    return {
      fromHash: fromHash,
      toHash: fromHash,
      statusInfo: {
        message: 'Transaction reverted.',
        status: 'FAILED',
      },
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
