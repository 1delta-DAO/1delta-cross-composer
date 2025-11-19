import { SlippageSelector } from "./SlippageSelector"
import { useSlippage } from "../../contexts/SlippageContext"

export function SwapSlippageSelector() {
  const { slippage, setSlippage, priceImpact } = useSlippage()

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-xs">
        ⚙
      </div>
      <div tabIndex={0} className="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-64">
        <SlippageSelector slippage={slippage} onSlippageChange={setSlippage} priceImpact={priceImpact} />
      </div>
    </div>
  )
}
