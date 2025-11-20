import { chains as dataChains } from "@1delta/data-sdk"

export function getChainConfig(chainId: string) {
  const all = dataChains()
  return all?.[chainId]
}
