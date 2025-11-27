import { useState, useMemo, useEffect, useRef } from 'react'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { buildTransactionUrl } from '../../lib/explorer'
import { useTxHistory } from '../../contexts/TxHistoryContext'

export function TxHistoryButton() {
  const { entries, clearAll, isPolling } = useTxHistory()
  const { data: chains } = useChainsRegistry()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.createdAt - a.createdAt)
  }, [entries])

  const hasEntries = sortedEntries.length > 0

  const iconSize = 22

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const node = containerRef.current
      if (!node) return
      if (!node.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="btn btn-ghost btn-circle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Transaction history"
      >
        {isPolling ? (
          <span className="loading loading-spinner" style={{ width: iconSize, height: iconSize }} />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l2.5 2.5M12 3a9 9 0 1 0 9 9"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25 3 7.5M3 7.5h4.5" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto bg-base-100 border border-base-300 shadow-xl rounded-2xl z-40">
          <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between">
            <span className="text-sm font-semibold">Recent actions</span>
            <div className="flex items-center gap-2">
              {isPolling && <span className="badge badge-warning badge-xs">Polling</span>}
              {hasEntries && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => clearAll()}>
                  Clear
                </button>
              )}
            </div>
          </div>
          {hasEntries ? (
            <div className="divide-y divide-base-300">
              {sortedEntries.map((entry) => {
                const created = new Date(entry.createdAt)
                const time = created.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
                const date = created.toLocaleDateString()

                const typeLabel =
                  entry.type === 'swap'
                    ? 'Swap'
                    : entry.type === 'bridge_with_actions'
                      ? 'Bridge + actions'
                      : 'Bridge'

                const statusLabel =
                  entry.status === 'completed'
                    ? 'Completed'
                    : entry.status === 'failed'
                      ? 'Failed'
                      : 'Pending'

                const statusClass =
                  entry.status === 'completed'
                    ? 'badge-success'
                    : entry.status === 'failed'
                      ? 'badge-error'
                      : 'badge-warning'

                const srcUrl =
                  entry.srcChainId && entry.srcHash
                    ? buildTransactionUrl(chains || {}, entry.srcChainId, entry.srcHash)
                    : undefined

                const dstUrl =
                  entry.dstChainId && entry.dstHash
                    ? buildTransactionUrl(chains || {}, entry.dstChainId, entry.dstHash)
                    : undefined

                return (
                  <div key={entry.id} className="px-4 py-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{typeLabel}</span>
                      <span className={`badge badge-xs ${statusClass}`}>{statusLabel}</span>
                    </div>
                    <div className="text-xs text-base-content/70">
                      <span>
                        {date} {time}
                      </span>
                    </div>
                    {entry.srcHash && entry.srcChainId && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="opacity-70">Source:</span>
                        {srcUrl ? (
                          <a
                            href={srcUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-primary hover:underline"
                          >
                            {entry.srcHash.slice(0, 6)}...{entry.srcHash.slice(-4)}
                          </a>
                        ) : (
                          <span className="font-mono">
                            {entry.srcHash.slice(0, 6)}...{entry.srcHash.slice(-4)}
                          </span>
                        )}
                      </div>
                    )}
                    {entry.dstHash && entry.dstChainId && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="opacity-70">Destination:</span>
                        {dstUrl ? (
                          <a
                            href={dstUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-primary hover:underline"
                          >
                            {entry.dstHash.slice(0, 6)}...{entry.dstHash.slice(-4)}
                          </a>
                        ) : (
                          <span className="font-mono">
                            {entry.dstHash.slice(0, 6)}...{entry.dstHash.slice(-4)}
                          </span>
                        )}
                      </div>
                    )}
                    {entry.type === 'bridge_with_actions' && (
                      <div className="text-xs text-info">Includes destination actions</div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-sm text-center text-base-content/70">
              No recent actions
            </div>
          )}
        </div>
      )}
    </div>
  )
}
