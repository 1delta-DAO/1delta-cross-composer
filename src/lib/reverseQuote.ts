import { formatUnits } from 'viem'
import type { RawCurrencyAmount } from '../types/currency'
import { CurrencyHandler } from '../sdk/types'

export function calculateReverseQuoteBuffer(slippage?: number): number {
  const slippageDecimal = slippage ? slippage / 100 : 0
  const slippageBasedBuffer = slippageDecimal * 2 // todo: change after new trade-sdk released
  return Math.max(0.003, slippageBasedBuffer)
}

export function reverseQuote(
  decimalsOut: number,
  amountOut: string | bigint,
  priceIn: number,
  priceOut: number,
  slippage?: number,
  customBuffer?: number,
) {
  if (priceIn <= 0 || priceOut <= 0) {
    throw new Error('Invalid prices: priceIn and priceOut must be greater than 0')
  }

  const buffer = customBuffer !== undefined ? customBuffer : calculateReverseQuoteBuffer(slippage)
  const amOutNr = Number(formatUnits(BigInt(amountOut ?? 0), decimalsOut))
  const amIn = ((amOutNr * priceOut) / priceIn) * (1 + buffer)
  return amIn.toString()
}

export interface QuoteValidationResult {
  isValid: boolean
  requiredBuffer: number
  hasHighSlippageLoss: boolean
  actualOutput: number
  minRequired: number
}

const MAX_BUFFER = 0.05

export function validateQuoteOutput(quoteOutputAmount: number, minRequiredAmount: RawCurrencyAmount): QuoteValidationResult {
  const minRequired = CurrencyHandler.toExactNumber(minRequiredAmount)

  if (quoteOutputAmount >= minRequired) {
    return {
      isValid: true,
      requiredBuffer: 0,
      hasHighSlippageLoss: false,
      actualOutput: quoteOutputAmount,
      minRequired,
    }
  }

  const requiredBuffer = minRequired / quoteOutputAmount - 1
  const hasHighSlippageLoss = requiredBuffer > MAX_BUFFER

  return {
    isValid: false,
    requiredBuffer,
    hasHighSlippageLoss,
    actualOutput: quoteOutputAmount,
    minRequired,
  }
}

export function calculateAdjustedBuffer(currentBuffer: number, requiredBuffer: number, slippage?: number): number {
  const slippageBasedMin = calculateReverseQuoteBuffer(slippage)
  const neededBuffer = Math.max(currentBuffer, requiredBuffer, slippageBasedMin)
  return Math.min(MAX_BUFFER, neededBuffer)
}
