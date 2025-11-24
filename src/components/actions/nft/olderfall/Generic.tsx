/* ---------- UI subcomponents ---------- */

export function OlderfallHeader() {
  return <div className="font-semibold text-sm">Olderfall NFTs</div>
}

export function OlderfallLoadingState() {
  return (
    <div className="flex items-center gap-2 text-xs opacity-70">
      <span className="loading loading-spinner loading-xs" />
      <span>Loading listings from Sequence…</span>
    </div>
  )
}

export function OlderfallEmptyState() {
  return <div className="text-xs opacity-70">No Olderfall listings found or Sequence API not configured.</div>
}
