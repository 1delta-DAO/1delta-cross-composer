import { useMemo, useState, useEffect } from "react"
import { chains as getChains } from "@1delta/data-sdk"
import { getReadySnapshot, subscribeReady } from "@1delta/trade-sdk/dist/data/readinessStore"

export type ExplorerInfo = {
  name?: string
  url: string
  standard?: string
  icon?: string
}

export type ChainInfo = {
  name: string
  chain: string
  icon?: string
  rpc?: string[]
  faucets?: string[]
  nativeCurrency: { name: string; symbol: string; decimals: number }
  infoURL?: string
  shortName?: string
  chainId: number | string
  networkId?: number | string
  explorers?: ExplorerInfo[]
  enum?: string
  key?: string
}

export type ChainsRegistryRecord = Record<
  string,
  {
    data: ChainInfo
    explorers: Record<string, ExplorerInfo>
  }
>

export function useChainsRegistry() {
  const [ready, setReady] = useState<boolean>(() => getReadySnapshot())
  const [data, setData] = useState<ChainsRegistryRecord | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsub = subscribeReady(() => setReady(true))
    return unsub
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      const map = getChains() as unknown as Record<string, ChainInfo>
      const normalized: ChainsRegistryRecord = {}
      for (const [chainId, chain] of Object.entries(map)) {
        const explorersArray = (chain.explorers ?? []) as ExplorerInfo[]
        const explorers: Record<string, ExplorerInfo> = {}
        for (const exp of explorersArray) {
          const key = (exp?.name || exp?.url || "explorer") as string
          explorers[key] = { ...exp }
        }
        normalized[chainId] = {
          data: chain as ChainInfo,
          explorers,
        }
      }
      setData(normalized)
      setError(null)
    } catch (e) {
      setError(e as Error)
    }
  }, [ready])

  return useMemo(
    () => ({
      data,
      isLoading: !ready || !data,
      error,
    }),
    [data, ready, error],
  )
}
