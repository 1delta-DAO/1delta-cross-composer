import { useState, useEffect, useMemo, useRef } from "react"
import { useChainsRegistry } from "../../sdk/hooks/useChainsRegistry"
import { SUPPORTED_CHAIN_IDS } from "../../lib/data/chainIds"
import { Logo } from "../common/Logo"
import { SupportedChainId } from "../../sdk/types"

type Props = {
  value?: string
  onChange: (chainId: string) => void
}

const RELEVANT_CHAIN_IDS = [SupportedChainId.OP_MAINNET, SupportedChainId.BASE, SupportedChainId.MOONBEAM]

export function ChainSelector({ value, onChange }: Props) {
  const { data, isLoading } = useChainsRegistry()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    function onDocClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener("keydown", onKey)
      document.addEventListener("mousedown", onDocClick)
    }
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDocClick)
    }
  }, [open])

  const allowed = useMemo(() => new Set(SUPPORTED_CHAIN_IDS), [])
  const items = useMemo(() => {
    if (!data) return [] as Array<{ id: string; name: string; icon?: string }>
    const entries = Object.entries(data)
      .filter(([id]) => allowed.has(id as SupportedChainId))
      .map(([id, rec]) => ({ id, name: rec.data.name, icon: rec.data.icon }))
    return entries
      .filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()) || idMatches(e.id, query))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, query, allowed])

  const relevant = useMemo(() => items.filter((i) => RELEVANT_CHAIN_IDS.includes(i.id as SupportedChainId)).slice(0, 3), [items])
  const selected = value && data ? data[value] : undefined

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" className="btn btn-outline w-full flex items-center gap-2" onClick={() => setOpen((o) => !o)}>
        <Logo src={selected?.data.icon} alt={selected?.data.name || "Chain"} fallbackText={selected?.data.shortName || selected?.data.chain} />
        <span className="truncate">{selected?.data.name || (isLoading ? "Loading chains..." : "Select chain")}</span>
        <span className="ml-auto tab">▼</span>
      </button>
      {open && (
        <div className="mt-2 p-2 rounded-box border border-base-300 bg-base-100 shadow-xl absolute z-20 w-full">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {relevant.map((c) => (
              <button
                key={c.id}
                className="btn btn-sm btn-ghost justify-start gap-2"
                onClick={() => {
                  onChange(c.id)
                  setOpen(false)
                }}
              >
                <Logo src={data?.[c.id]?.data.icon} alt={c.name} fallbackText={data?.[c.id]?.data.shortName || data?.[c.id]?.data.chain} />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chains"
            className="input input-bordered w-full mb-2"
          />
          <div className="max-h-64 overflow-auto">
            {items.map((c) => (
              <button
                key={c.id}
                className="w-full py-2 px-2 hover:bg-base-200 rounded flex items-center gap-2"
                onClick={() => {
                  onChange(c.id)
                  setOpen(false)
                }}
              >
                <Logo src={data?.[c.id]?.data.icon} alt={c.name} fallbackText={data?.[c.id]?.data.shortName || data?.[c.id]?.data.chain} />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function idMatches(id: string, q: string): boolean {
  return id === q || id.startsWith(q)
}
