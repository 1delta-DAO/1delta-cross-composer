import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

export type TxHistoryType = "swap" | "bridge" | "bridge_with_actions"

export type TxHistoryStatus = "pending" | "completed" | "failed"

export type TxHistoryEntry = {
  id: string
  type: TxHistoryType
  createdAt: number
  srcChainId?: string
  dstChainId?: string
  srcHash?: string
  dstHash?: string
  hasDestinationActions?: boolean
  status: TxHistoryStatus
}

type TxHistoryContextValue = {
  entries: TxHistoryEntry[]
  createEntry: (entry: Omit<TxHistoryEntry, "id" | "createdAt"> & { id?: string; createdAt?: number }) => string
  updateEntry: (id: string, patch: Partial<TxHistoryEntry>) => void
  clearAll: () => void
  isPolling: boolean
}

const STORAGE_KEY = "moonbeamer:txHistory"

const TxHistoryContext = createContext<TxHistoryContextValue>({
  entries: [],
  createEntry: () => "",
  updateEntry: () => {},
  clearAll: () => {},
  isPolling: false,
})

export function TxHistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TxHistoryEntry[]>(() => {
    try {
      if (typeof window === "undefined") return []
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as TxHistoryEntry[]
      if (Array.isArray(parsed)) {
        return parsed
      }
      return []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {}
  }, [entries])

  const createEntry = useCallback((entry: Omit<TxHistoryEntry, "id" | "createdAt"> & { id?: string; createdAt?: number }) => {
    const id = entry.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const createdAt = entry.createdAt || Date.now()
    const full: TxHistoryEntry = { ...entry, id, createdAt }
    setEntries((prev) => [full, ...prev])
    return id
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<TxHistoryEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const clearAll = useCallback(() => {
    setEntries([])
  }, [])

  const isPolling = entries.some((e) => e.status === "pending")

  return <TxHistoryContext.Provider value={{ entries, createEntry, updateEntry, clearAll, isPolling }}>{children}</TxHistoryContext.Provider>
}

export function useTxHistory() {
  return useContext(TxHistoryContext)
}
