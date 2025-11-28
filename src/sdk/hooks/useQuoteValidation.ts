import { useState, useEffect, useCallback } from 'react'
import { calculateReverseQuoteBuffer } from '../../lib/reverseQuote'
import type { Quote } from './useQuoteFetcher'

export interface UseQuoteValidationReturn {
  highSlippageLossWarning: boolean
  currentBuffer: number
  validateAndUpdateQuotes: (
    quotes: Quote[],
    isRefresh?: boolean,
    isUserSelection?: boolean
  ) => {
    quotes: Quote[]
    highSlippageLossWarning: boolean
    currentBuffer: number
  }
  updateBufferForSlippage: (slippage: number) => void
}

export function useQuoteValidation(slippage: number): UseQuoteValidationReturn {
  const [highSlippageLossWarning, setHighSlippageLossWarning] = useState(false)
  const [currentBuffer, setCurrentBuffer] = useState<number>(calculateReverseQuoteBuffer(slippage))

  const validateAndUpdateQuotes = useCallback(
    (
      quotes: Quote[],
      isRefresh?: boolean,
      isUserSelection?: boolean
    ): {
      quotes: Quote[]
      highSlippageLossWarning: boolean
      currentBuffer: number
    } => {
      setHighSlippageLossWarning(false)
      return {
        quotes,
        highSlippageLossWarning: false,
        currentBuffer,
      }
    },
    [currentBuffer]
  )

  const updateBufferForSlippage = useCallback((newSlippage: number) => {
    setCurrentBuffer(calculateReverseQuoteBuffer(newSlippage))
  }, [])

  useEffect(() => {
    updateBufferForSlippage(slippage)
  }, [slippage, updateBufferForSlippage])

  return {
    highSlippageLossWarning,
    currentBuffer,
    validateAndUpdateQuotes,
    updateBufferForSlippage,
  }
}
