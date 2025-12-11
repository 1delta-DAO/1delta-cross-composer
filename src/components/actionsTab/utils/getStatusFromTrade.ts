import { GenericTrade, getViemProvider } from '@1delta/lib-utils'
import { getBridgeStatus } from '@1delta/trade-sdk'
import { PublicClient } from 'viem'

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
) {
  // same chain case
  if (trade.inputAmount.currency.chainId === trade.outputAmount.currency.chainId) {
    const provider =
      publicClient ?? (await getViemProvider({ chainId: trade.inputAmount.currency.chainId }))
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
