// src/components/themeSwitcher.tsx
'use client'

import { useEffect, useState } from 'react'

const THEMES = [
  'terminal',
  'light',
  'dark',
  'forest',
  'corporate',
  'synthwave',
  'cyberpunk',
  'moonbeam',
  'luxury',
] as const

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>('synthwave')

  // Initialize from localStorage & apply once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = window.localStorage.getItem('theme')
    const initial = stored && THEMES.includes(stored as any) ? stored : 'synthwave'

    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  // Apply on change
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <select
      className="select select-bordered select-sm pr-10"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
    >
      {THEMES.map((t) => (
        <option key={t} value={t}>
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </option>
      ))}
    </select>
  )
}
