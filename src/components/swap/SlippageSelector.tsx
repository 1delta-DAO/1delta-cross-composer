import { useState, useEffect } from "react"

type SlippageMode = "auto" | "custom"

type Props = {
  slippage: number
  onSlippageChange: (slippage: number) => void
  priceImpact?: number
}

const PRESETS = [0.01, 0.05, 0.1, 0.5]

function calculateAutoSlippage(priceImpact?: number): number {
  if (priceImpact === undefined || priceImpact <= 0) {
    // Default to 0.3% for small trades
    return 0.3
  }

  if (priceImpact <= 1) return 0.3
  if (priceImpact <= 3) return 0.5
  if (priceImpact <= 5) return 1.0
  if (priceImpact <= 10) return 2.0
  return 3.0
}

export function SlippageSelector({ slippage, onSlippageChange, priceImpact }: Props) {
  const [mode, setMode] = useState<SlippageMode>("auto")
  const [customValue, setCustomValue] = useState("")

  const autoSlippage = calculateAutoSlippage(priceImpact)

  useEffect(() => {
    if (Math.abs(slippage - autoSlippage) < 0.01) {
      setMode("auto")
      setCustomValue("")
    } else if (PRESETS.includes(slippage)) {
      setMode("custom")
      setCustomValue(slippage.toString())
    } else {
      setMode("custom")
      setCustomValue(slippage.toString())
    }
  }, [slippage, autoSlippage])

  useEffect(() => {
    if (mode === "auto" && Math.abs(slippage - autoSlippage) >= 0.01) {
      onSlippageChange(autoSlippage)
    }
  }, [mode, autoSlippage, slippage, onSlippageChange])

  const handlePresetClick = (preset: number) => {
    setMode("custom")
    setCustomValue(preset.toString())
    onSlippageChange(preset)
  }

  const handleAutoClick = () => {
    setMode("auto")
    setCustomValue("")
    onSlippageChange(autoSlippage)
  }

  const handleCustomChange = (value: string) => {
    setMode("custom")
    setCustomValue(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0 && num <= 50) {
      onSlippageChange(num)
    }
  }

  const displaySlippage = mode === "auto" ? autoSlippage : slippage

  return (
    <div className="space-y-2">
      <div className="px-2 py-1 text-xs opacity-70">Max slippage</div>
      <div className="flex flex-wrap gap-2 px-2 pb-2">
        <button className={`btn btn-xs ${mode === "auto" ? "btn-primary" : "btn-ghost"}`} onClick={handleAutoClick}>
          Auto
        </button>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            className={`btn btn-xs ${mode === "custom" && Math.abs(slippage - preset) < 0.01 ? "btn-primary" : "btn-ghost"}`}
            onClick={() => handlePresetClick(preset)}
          >
            {preset}%
          </button>
        ))}
        <div className="join">
          <input
            type="number"
            step="0.01"
            min="0"
            max="50"
            placeholder="Custom"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="input input-xs input-bordered join-item w-20"
          />
          <span className="join-item px-2 text-xs opacity-70 flex items-center">%</span>
        </div>
      </div>
      {mode === "auto" && priceImpact !== undefined && (
        <div className="px-2 text-xs opacity-60">
          Auto: {autoSlippage.toFixed(2)}% (based on {priceImpact.toFixed(2)}% price impact)
        </div>
      )}
      {mode === "auto" && priceImpact === undefined && <div className="px-2 text-xs opacity-60">Auto: {autoSlippage.toFixed(2)}% (default)</div>}
    </div>
  )
}
