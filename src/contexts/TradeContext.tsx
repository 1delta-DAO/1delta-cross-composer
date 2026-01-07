import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useSlippage } from './SlippageContext'
import { useDestinationInfo } from './DestinationInfoContext'
import type { RawCurrency, RawCurrencyAmount } from '../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import type { ActionCall } from '../components/actions/shared/types'

export interface TradeSettings {
  slippage: number
  priceImpact: number | undefined
}

export type TradeSide = 'src' | 'dst'

export interface TradeDestination {
  currencyAmount?: RawCurrencyAmount
  currency?: RawCurrency
  actionLabel?: string
  actionId?: string
  actionData?: unknown
}

export interface TradeRoute {
  srcAmount?: RawCurrencyAmount
  dstAmount?: RawCurrencyAmount
}

export interface TradeActions {
  side: TradeSide
  calls: ActionCall[]
}

export interface TradeContextValue {
  slippage: number
  setSlippage: (slippage: number) => void
  priceImpact: number | undefined
  setPriceImpact: (priceImpact: number | undefined) => void
  flowMode: TradeSide
  setFlowMode: (mode: TradeSide) => void
  destination: TradeDestination | undefined
  setDestination: (
    currencyAmount: RawCurrencyAmount | undefined,
    actionLabel?: string,
    actionId?: string,
    actionData?: unknown
  ) => void
  clearDestination: () => void
  route: TradeRoute
  setSrcAmount: (srcAmount: RawCurrencyAmount | undefined) => void
  setDstAmount: (dstAmount: RawCurrencyAmount | undefined) => void
  clearRoute: () => void
  actions: TradeActions
  setCalls: (calls: ActionCall[]) => void
  clearCalls: () => void
  inputCalls: ActionCall[] | undefined
  destinationCalls: ActionCall[] | undefined
}

const TradeContext = createContext<TradeContextValue | undefined>(undefined)

export function TradeProvider({ children }: { children: ReactNode }) {
  const { slippage, setSlippage, priceImpact, setPriceImpact } = useSlippage()
  const {
    destinationInfo,
    setDestinationInfoState,
    flowMode: destinationFlowMode,
    setFlowMode: setDestinationFlowMode,
  } = useDestinationInfo()

  const [route, setRoute] = useState<TradeRoute>({})
  const [calls, setCallsState] = useState<ActionCall[]>([])

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

  const flowMode: TradeSide = destinationFlowMode

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

  const setFlowMode = useCallback(
    (mode: TradeSide) => {
      setDestinationFlowMode(mode)
      setRoute({})
      setCallsState([])
      setDestinationInfoState(undefined)
      setPriceImpact(undefined)
    },
    [setDestinationFlowMode, setDestinationInfoState, setPriceImpact]
  )

  const setSrcAmount = useCallback((srcAmount: RawCurrencyAmount | undefined) => {
    setRoute((prev) => ({ ...prev, srcAmount }))
  }, [])

  const setDstAmount = useCallback((dstAmount: RawCurrencyAmount | undefined) => {
    setRoute((prev) => ({ ...prev, dstAmount }))
  }, [])

  const clearRoute = useCallback(() => {
    setRoute({})
  }, [])

  const setCalls = useCallback((next: ActionCall[]) => {
    setCallsState(next)
  }, [])

  const clearCalls = useCallback(() => {
    setCallsState([])
  }, [])

  const actions = useMemo<TradeActions>(() => {
    return {
      side: flowMode,
      calls,
    }
  }, [flowMode, calls])

  const inputCalls = useMemo(() => {
    return actions.side === 'src' && actions.calls.length > 0 ? actions.calls : undefined
  }, [actions.side, actions.calls])

  const destinationCalls = useMemo(() => {
    return actions.side === 'dst' && actions.calls.length > 0 ? actions.calls : undefined
  }, [actions.side, actions.calls])

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
      route,
      setSrcAmount,
      setDstAmount,
      clearRoute,
      actions,
      setCalls,
      clearCalls,
      inputCalls,
      destinationCalls,
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
      route,
      setSrcAmount,
      setDstAmount,
      clearRoute,
      actions,
      setCalls,
      clearCalls,
      inputCalls,
      destinationCalls,
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

export function useTradeInput() {
  const { route, setSrcAmount } = useTradeContext()
  return { srcAmount: route.srcAmount, setSrcAmount }
}

export function useTradeReverseInput() {
  const { route, setDstAmount } = useTradeContext()
  return { dstAmount: route.dstAmount, setDstAmount }
}
