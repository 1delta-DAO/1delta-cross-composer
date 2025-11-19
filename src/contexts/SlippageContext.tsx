import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type SlippageContextType = {
  slippage: number
  setSlippage: (slippage: number) => void
  priceImpact: number | undefined
  setPriceImpact: (priceImpact: number | undefined) => void
}

const SlippageContext = createContext<SlippageContextType | undefined>(undefined)

export function SlippageProvider({ children }: { children: ReactNode }) {
  const [slippage, setSlippageState] = useState(0.3) // Default to auto (0.3%)
  const [priceImpact, setPriceImpactState] = useState<number | undefined>(undefined)

  const setSlippage = useCallback((newSlippage: number) => {
    setSlippageState(newSlippage)
  }, [])

  const setPriceImpact = useCallback((newPriceImpact: number | undefined) => {
    setPriceImpactState(newPriceImpact)
  }, [])

  return <SlippageContext.Provider value={{ slippage, setSlippage, priceImpact, setPriceImpact }}>{children}</SlippageContext.Provider>
}

export function useSlippage() {
  const context = useContext(SlippageContext)
  if (!context) {
    throw new Error("useSlippage must be used within SlippageProvider")
  }
  return context
}
