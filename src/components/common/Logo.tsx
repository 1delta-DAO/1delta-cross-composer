import { useState } from 'react'

type Props = {
  src?: string
  alt: string
  size?: number
  fallbackText?: string
  className?: string
}

export function Logo({ src, alt, size = 20, fallbackText, className }: Props) {
  const [error, setError] = useState(false)
  const dimension = { width: size, height: size }

  if (!src || error) {
    return (
      <div
        className={
          'rounded-full bg-base-200 text-base-content/70 flex items-center justify-center ' +
          (className || '')
        }
        style={dimension}
        aria-label={alt}
        title={alt}
      >
        <span style={{ fontSize: Math.max(10, Math.floor(size * 0.45)) }}>
          {fallbackText?.slice(0, 2)?.toUpperCase() || '?'}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={'rounded-full object-contain bg-base-100 ' + (className || '')}
      style={dimension}
    />
  )
}
