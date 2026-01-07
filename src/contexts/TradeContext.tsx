import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import { useSlippage } from './SlippageContext'
import {
  useDestinationInfo,
  type FlowMode,
} from './DestinationInfoContext'
import type { RawCurrency, RawCurrencyAmount } from '../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'

export interface TradeSettings {
  slippage: number
  priceImpact: number | undefined
}

export interface TradeDestination {
  currencyAmount?: RawCurrencyAmount
  currency?: RawCurrency
  actionLabel?: string
  actionId?: string
  actionData?: unknown
}

export interface TradeContextValue {
  slippage: number
  setSlippage: (slippage: number) => void
  priceImpact: number | undefined
  setPriceImpact: (priceImpact: number | undefined) => void
  flowMode: FlowMode
  setFlowMode: (mode: FlowMode) => void
  destination: TradeDestination | undefined
  setDestination: (
    currencyAmount: RawCurrencyAmount | undefined,
    actionLabel?: string,
    actionId?: string,
    actionData?: unknown
  ) => void
  clearDestination: () => void
}

const TradeContext = createContext<TradeContextValue | undefined>(undefined)

export function TradeProvider({ children }: { children: ReactNode }) {
  const { slippage, setSlippage, priceImpact, setPriceImpact } = useSlippage()
  const { destinationInfo, setDestinationInfoState, flowMode, setFlowMode } = useDestinationInfo()

  const destination = useMemo<TradeDestination | undefined>(() => {
    if (!destinationInfo) return undefined
    return {
      currencyAmount: destinationInfo.currencyAmount,
      currency: destinationInfo.currencyAmount?.currency as RawCurrency | undefined,
      actionLabel: destinationInfo.actionLabel,
      actionId: destinationInfo.actionId,
      actionData: destinationInfo.actionData,
    }
  }, [destinationInfo])

  const setDestination = useCallback(
    (
      currencyAmount: RawCurrencyAmount | undefined,
      actionLabel?: string,
      actionId?: string,
      actionData?: unknown
    ) => {
      if (!currencyAmount) {
        setDestinationInfoState(undefined)
        return
      }

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        setDestinationInfoState(undefined)
        return
      }

      setDestinationInfoState({
        currencyAmount,
        actionLabel,
        actionId,
        actionData,
      })
    },
    [setDestinationInfoState]
  )

  const clearDestination = useCallback(() => {
    setDestinationInfoState(undefined)
  }, [setDestinationInfoState])

  const value = useMemo<TradeContextValue>(
    () => ({
      slippage,
      setSlippage,
      priceImpact,
      setPriceImpact,
      flowMode,
      setFlowMode,
      destination,
      setDestination,
      clearDestination,
    }),
    [
      slippage,
      setSlippage,
      priceImpact,
      setPriceImpact,
      flowMode,
      setFlowMode,
      destination,
      setDestination,
      clearDestination,
    ]
  )

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>
}

export function useTradeContext(): TradeContextValue {
  const context = useContext(TradeContext)
  if (!context) {
    throw new Error('useTradeContext must be used within a TradeProvider')
  }
  return context
}

export function useTradeSettings(): TradeSettings {
  const { slippage, priceImpact } = useTradeContext()
  return { slippage, priceImpact }
}

export function useTradeDestination() {
  const { destination, setDestination, clearDestination } = useTradeContext()
  return { destination, setDestination, clearDestination }
}

