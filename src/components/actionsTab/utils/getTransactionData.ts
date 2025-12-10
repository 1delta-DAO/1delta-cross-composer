import { GenericTrade } from '@1delta/lib-utils'

/**
 * Build txn from trade
 * We need to move this to the SDK
 * @param trade sdk object that generates calldata via `assemble`
 */
export async function getTransactionData(trade: GenericTrade) {
  if (!trade) return null

  if ('assemble' in trade && typeof (trade as any).assemble === 'function') {
    const assembled = await (trade as any).assemble()
    const assembledItems = Array.isArray(assembled) ? assembled : [assembled]

    for (const item of assembledItems) {
      if (item && 'EVM' in item && (item as any).EVM) {
        return (item as any).EVM
      }

      if (item && (item as any).transaction) {
        const tx = (item as any).transaction
        const calldata = (tx as any).calldata ?? (tx as any).data
        if (tx && calldata && (tx as any).to) {
          return {
            to: (tx as any).to,
            calldata,
            value: (tx as any).value ?? 0n,
          }
        }
      }

      if (item && (item as any).to && ((item as any).calldata || (item as any).data)) {
        const calldata = (item as any).calldata ?? (item as any).data
        return {
          to: (item as any).to,
          calldata,
          value: (item as any).value ?? 0n,
        }
      }
    }
  }
  throw new Error('No assemble function found')
}
