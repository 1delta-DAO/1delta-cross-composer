import { useState, useEffect } from "react"
import { getReadySnapshot, subscribeReady } from "@1delta/trade-sdk/dist/data/readinessStore"

/**
 * Hook that resolves when data-sdk chain data is ready.
 */
export function useDataSdkReady() {
  const [ready, setReady] = useState<boolean>(() => getReadySnapshot())

  useEffect(() => {
    if (ready) return
    const unsub = subscribeReady(() => setReady(true))
    return unsub
  }, [ready])

  return ready
}
