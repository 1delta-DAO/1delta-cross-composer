import { useRef } from 'react'

export const REFRESH_INTERVAL_MS = 30_000

export function useQuoteRefreshHelpers() {
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRefreshTimeout = () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
  }

  const scheduleRefresh = (callback: () => void) => {
    clearRefreshTimeout()
    refreshTimeoutRef.current = setTimeout(() => {
      callback()
    }, REFRESH_INTERVAL_MS)
  }

  const cleanup = () => {
    clearRefreshTimeout()
  }

  return {
    refreshTimeoutRef,
    clearRefreshTimeout,
    scheduleRefresh,
    cleanup,
  }
}
