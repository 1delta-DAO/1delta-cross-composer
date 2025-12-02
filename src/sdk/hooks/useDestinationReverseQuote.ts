import { useEffect, useRef, useState } from 'react'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { reverseQuote } from '../../lib/reverseQuote'
import { useQuoteTrace } from '../../contexts/QuoteTraceContext'

export type ReverseQuoteState = 'idle' | 'calculating' | 'ready' | 'price_unavailable'

interface UseDestinationReverseQuoteParams {
  destinationAmount?: RawCurrencyAmount
  inputCurrency?: RawCurrency
  inputPrice?: number
  actionTokenPrice?: number
  slippage: number
  isLoadingPrices: boolean
  onInputAmountChange: (value: string) => void
}

export function useDestinationReverseQuote({
  destinationAmount,
  inputCurrency,
  inputPrice,
  actionTokenPrice,
  slippage,
  isLoadingPrices,
  onInputAmountChange,
}: UseDestinationReverseQuoteParams) {
  const [calculatedInputAmount, setCalculatedInputAmount] = useState<string>('')
  const [state, setState] = useState<ReverseQuoteState>('idle')
  const lastCalculatedPricesRef = useRef<{ priceIn: number; priceOut: number } | null>(null)
  const quoteTrace = useQuoteTrace()

  useEffect(() => {
    if (!destinationAmount) {
      setCalculatedInputAmount('')
      lastCalculatedPricesRef.current = null
      setState('idle')
      return
    }

    if (!inputCurrency) {
      setCalculatedInputAmount('')
      setState('idle')
      return
    }

    if (isLoadingPrices) {
      setState('calculating')
      return
    }

    const priceIn = inputPrice ?? 0
    const priceOut = actionTokenPrice ?? 0

    if (priceIn > 0 && priceOut > 0) {
      const lastPrices = lastCalculatedPricesRef.current
      const pricesChanged =
        !lastPrices || lastPrices.priceIn !== priceIn || lastPrices.priceOut !== priceOut

      const needsRecalculation =
        pricesChanged || !calculatedInputAmount || calculatedInputAmount === ''

      if (needsRecalculation) {
        const decimalsOut = destinationAmount.currency.decimals
        try {
          quoteTrace.addTrace({
            quotes: [],
            actionInfo: {
              actionType: 'reverse_quote',
              actionLabel: 'Reverse quote',
            },
            requestInfo: {
              srcCurrency: inputCurrency,
              dstCurrency: destinationAmount.currency,
              amount: destinationAmount.amount.toString(),
              slippage,
            },
            success: true,
          })

          const amountIn = reverseQuote(
            decimalsOut,
            destinationAmount.amount.toString(),
            priceIn,
            priceOut,
            slippage
          )

          setCalculatedInputAmount(amountIn)
          onInputAmountChange(amountIn)
          lastCalculatedPricesRef.current = { priceIn, priceOut }
          setState('ready')
        } catch (error) {
          console.error('Error calculating reverse quote:', error)
          setCalculatedInputAmount('')
          lastCalculatedPricesRef.current = null
          setState('price_unavailable')

          quoteTrace.addTrace({
            quotes: [],
            error: error instanceof Error ? error.message : 'Reverse quote failed',
            actionInfo: {
              actionType: 'reverse_quote',
              actionLabel: 'Reverse quote',
            },
            requestInfo: {
              srcCurrency: inputCurrency,
              dstCurrency: destinationAmount.currency,
              amount: destinationAmount.amount.toString(),
              slippage,
            },
            success: false,
          })
        }
      } else if (calculatedInputAmount && Number(calculatedInputAmount) > 0) {
        setState('ready')
      }
    } else {
      setCalculatedInputAmount('')
      lastCalculatedPricesRef.current = null
      setState('price_unavailable')
    }
  }, [
    destinationAmount,
    inputCurrency,
    inputPrice,
    actionTokenPrice,
    slippage,
    isLoadingPrices,
    calculatedInputAmount,
    onInputAmountChange,
  ])

  return {
    calculatedInputAmount,
    state,
  }
}
