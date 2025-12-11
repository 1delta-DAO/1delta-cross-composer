import { GenericTrade } from '@1delta/lib-utils'
import { Address, Hex } from 'viem'

/**
 * Build txn from trade
 * We need to move this to the SDK
 * @param trade sdk object that generates calldata via `assemble`
 */
export async function getTransactionData(trade: GenericTrade): Promise<{
  to: Address
  data: Hex
  value: bigint
} | null> {
  if (!trade) return null

  if ('assemble' in trade && typeof (trade as any).assemble === 'function') {
    const assembled = await (trade as any).assemble()
    const assembledItems = Array.isArray(assembled) ? assembled : [assembled]

    for (const item of assembledItems) {
      if (item && 'EVM' in item && (item as any).EVM) {
        const tx = (item as any).EVM
        const calldata = (tx as any).calldata ?? (tx as any).data
        return {
          to: (tx as any).to,
          data: calldata,
          value: (tx as any).value ?? 0n,
        }
      }

      if (item && (item as any).transaction) {
        const tx = (item as any).transaction
        const calldata = (tx as any).calldata ?? (tx as any).data
        if (tx && calldata && (tx as any).to) {
          return {
            to: (tx as any).to,
            data: calldata,
            value: (tx as any).value ?? 0n,
          }
        }
      }

      if (item && (item as any).to && ((item as any).calldata || (item as any).data)) {
        const calldata = (item as any).calldata ?? (item as any).data
        return {
          to: (item as any).to,
          data: calldata,
          value: (item as any).value ?? 0n,
        }
      }
    }
  }
  throw new Error('No assemble function found')
}
