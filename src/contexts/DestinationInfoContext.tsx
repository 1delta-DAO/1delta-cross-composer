import { RawCurrencyAmount } from '@1delta/lib-utils'
import React, { createContext, useContext, useState } from 'react'

export interface DestinationInfo {
  currencyAmount?: RawCurrencyAmount
  actionLabel?: string
  actionId?: string
  actionData?: any
}

export type FlowMode = 'src' | 'dst'

interface DestinationInfoContextValue {
  destinationInfo?: DestinationInfo
  setDestinationInfoState: React.Dispatch<React.SetStateAction<DestinationInfo | undefined>>
  flowMode: FlowMode
  setFlowMode: React.Dispatch<React.SetStateAction<FlowMode>>
}

// -------- Create Context --------
const DestinationInfoContext = createContext<DestinationInfoContextValue | undefined>(undefined)

// -------- Provider Component --------
export const DestinationInfoProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [destinationInfo, setDestinationInfoState] = useState<DestinationInfo | undefined>(
    undefined
  )
  const [flowMode, setFlowMode] = useState<FlowMode>('dst')

  return (
    <DestinationInfoContext.Provider
      value={{ destinationInfo, setDestinationInfoState, flowMode, setFlowMode }}
    >
      {children}
    </DestinationInfoContext.Provider>
  )
}

// -------- Hook for Easier Usage --------
export const useDestinationInfo = () => {
  const ctx = useContext(DestinationInfoContext)
  if (!ctx) {
    throw new Error('useDestinationInfo must be used within a DestinationInfoProvider')
  }
  return ctx
}

export function useActionData() {
  return useDestinationInfo().destinationInfo?.actionData
}
