export function filterNumeric(s: string): string {
  // Allow digits and a single dot
  s = s.replace(/[^0-9.]/g, '')
  const parts = s.split('.')
  if (parts.length <= 1) return s
  return parts[0] + '.' + parts.slice(1).join('').replace(/\./g, '')
}

export function pickPreferredToken(map: Record<string, any>, native?: string): string | undefined {
  const entries = Object.entries(map)
  if (!entries.length) return undefined
  if (native) {
    const found = entries.find(([, t]) => t.symbol?.toUpperCase() === native.toUpperCase())
    if (found) return found[0]
    const wrapped = entries.find(([, t]) => t.symbol?.toUpperCase() === `W${native.toUpperCase()}`)
    if (wrapped) return wrapped[0]
  }
  return entries[0][0]
}

export function formatDisplayAmount(val: string): string {
  // Normalize
  if (!val) return '0'
  const [intPartRaw, fracRaw = ''] = val.split('.')
  const intPart = intPartRaw.replace(/^0+/, '') || '0'
  const maxFrac = intPart.length >= 4 ? 2 : 10
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, '')
  return frac ? `${intPart}.${frac}` : intPart
}
