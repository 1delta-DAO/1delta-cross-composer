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
const DEFAULT_THEME = 'dark'

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>(DEFAULT_THEME)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('theme')
    const initial = stored && THEMES.includes(stored as any) ? stored : DEFAULT_THEME
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <div className="relative inline-block w-30">
      <select
        className="select select-bordered select-sm w-full pr-10 appearance-none bg-base-100 hover:bg-base-200 transition rounded-xl"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
      >
        {THEMES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
