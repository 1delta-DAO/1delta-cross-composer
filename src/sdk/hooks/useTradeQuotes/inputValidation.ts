import {
  validateQuoteRequest,
  detectChainTransition as detectChainTransitionNew,
  type QuoteValidation,
} from '../../services/quoteService'
import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'
import type { ActionCall } from '../../../components/actions/shared/types'

export interface InputValidationResult {
  isValid: boolean
  isSameChain: boolean
  shouldFetch: boolean
  reason?: string
}

/** @deprecated Use validateQuoteRequest from sdk/services/quoteService instead */
export function validateInputs(
  srcAmount?: RawCurrencyAmount,
  dstCurrency?: RawCurrency,
  inputCalls?: ActionCall[]
): InputValidationResult {
  const result = validateQuoteRequest(srcAmount, dstCurrency, inputCalls)
  return {
    isValid: result.isValid,
    isSameChain: result.isSameChain,
    shouldFetch: result.isValid,
    reason: result.reason,
  }
}

/** @deprecated Use detectChainTransition from sdk/services/quoteService instead */
export function detectChainTransition(
  currentIsSameChain: boolean,
  previousIsSameChain: boolean | null
): boolean {
  return detectChainTransitionNew(currentIsSameChain, previousIsSameChain)
}
