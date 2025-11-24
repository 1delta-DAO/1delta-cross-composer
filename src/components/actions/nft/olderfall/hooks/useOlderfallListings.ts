import { useEffect, useState } from "react"
import type { OlderfallListing } from "../../../../../lib/sequence/marketplace"
import { fetchOlderfallListings } from "../../../../../lib/sequence/marketplace"

export function useOlderfallListings(enabled: boolean, chainId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listings, setListings] = useState<OlderfallListing[]>([])

  useEffect(() => {
    if (!enabled) {
      if (listings.length > 0) {
        setListings([])
      }
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchOlderfallListings(chainId, controller.signal)
        if (cancelled) {
          return
        }
        setListings(data)
      } catch (e: any) {
        if (cancelled || controller.signal.aborted) {
          return
        }
        setError(e?.message || "Failed to load Olderfall listings")
        setListings([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, chainId])

  return {
    listings,
    loading,
    error,
  }
}
