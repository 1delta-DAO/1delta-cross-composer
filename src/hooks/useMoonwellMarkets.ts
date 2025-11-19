import { useEffect, useMemo, useState } from "react"
import { getCachedMarkets, isMarketsLoading, getMarketsError, subscribeToCacheChanges, type MoonwellMarket } from "../lib/moonwell/marketCache"
import { MOONWELL_LENS, MOONWELL_COMPTROLLER, MOONWELL_UNDERLYING_TO_MTOKEN } from "../lib/moonwell/consts"
import { SupportedChainId } from "@1delta/lib-utils"

export type { MoonwellMarket }
export { MOONWELL_LENS, MOONWELL_COMPTROLLER, MOONWELL_UNDERLYING_TO_MTOKEN }

export function useMoonwellMarkets(chainId?: string) {
  const [markets, setMarkets] = useState<MoonwellMarket[] | undefined>(getCachedMarkets())
  const [loading, setLoading] = useState(isMarketsLoading())
  const [error, setError] = useState<string | undefined>(getMarketsError())

  useEffect(() => {
    setMarkets(getCachedMarkets())
    setLoading(isMarketsLoading())
    setError(getMarketsError())

    // Subscribe to cache changes
    const unsubscribe = subscribeToCacheChanges(() => {
      setMarkets(getCachedMarkets())
      setLoading(isMarketsLoading())
      setError(getMarketsError())
    })

    return unsubscribe
  }, [])

  const filteredMarkets = useMemo(() => {
    if (!chainId || chainId !== SupportedChainId.MOONBEAM) {
      return undefined
    }
    return markets
  }, [markets, chainId])

  return useMemo(
    () => ({
      markets: filteredMarkets,
      loading,
      error,
    }),
    [filteredMarkets, loading, error],
  )
}
