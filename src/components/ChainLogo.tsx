import React from "react"
import { getChainConfig } from "../lib/chains"

interface ChainLogoProps {
  chainId: string | number
  size?: number
  className?: string
}

export default function ChainLogo({ chainId, size = 24, className = "" }: ChainLogoProps) {
  const chainConfig = getChainConfig(typeof chainId === "number" ? chainId.toString() : chainId)

  if (!chainConfig) {
    return (
      <div className={`flex items-center justify-center bg-base-300 rounded-full ${className}`} style={{ width: size, height: size }}>
        <span className="text-xs">?</span>
      </div>
    )
  }

  if (chainConfig.logoURI) {
    return (
      <>
        <img
          src={chainConfig.logoURI}
          alt={chainConfig.name}
          className={`rounded-full ${className}`}
          style={{ width: size, height: size }}
          onError={(e) => {
            // Fallback to name if image fails to load
            const target = e.target as HTMLImageElement
            target.style.display = "none"
          }}
        />
        <div
          className={`flex items-center justify-center bg-base-300 rounded-full ${className}`}
          style={{ width: size, height: size, display: "none" }}
        >
          <span className="text-xs font-bold">{chainConfig.name[0]}</span>
        </div>
      </>
    )
  }

  return (
    <div className={`flex items-center justify-center bg-base-300 rounded-full ${className}`} style={{ width: size, height: size }}>
      <span className="text-xs font-bold">{chainConfig.name[0]}</span>
    </div>
  )
}
