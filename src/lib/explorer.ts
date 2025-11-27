import { ChainsRegistryRecord } from '../sdk/hooks/useChainsRegistry'

function getPrimaryExplorerBase(
  chain: ChainsRegistryRecord[string] | undefined
): string | undefined {
  if (!chain) return undefined
  // Prefer first EIP3091 explorer
  const explorers = Object.values(chain.explorers)
  const eip3091 = explorers.find((e) => (e.standard || '').toUpperCase() === 'EIP3091')
  return (eip3091 || explorers[0])?.url
}

export function buildAddressUrl(
  registry: ChainsRegistryRecord,
  chainId: string,
  address: string
): string | undefined {
  const chain = registry[chainId]
  const base = getPrimaryExplorerBase(chain)
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/address/${address}`
}

export function buildTokenUrl(
  registry: ChainsRegistryRecord,
  chainId: string,
  token: string
): string | undefined {
  const chain = registry[chainId]
  const base = getPrimaryExplorerBase(chain)
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/token/${token}`
}

export function buildTransactionUrl(
  registry: ChainsRegistryRecord,
  chainId: string,
  txHash: string
): string | undefined {
  const chain = registry[chainId]
  const base = getPrimaryExplorerBase(chain)
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/tx/${txHash}`
}
