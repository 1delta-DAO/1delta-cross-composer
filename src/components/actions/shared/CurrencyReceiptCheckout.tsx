import { RawCurrency } from '@1delta/lib-utils'
import { PayInfo } from '../../transactionSummary/PayInfo'

interface CurrencyReceiveCheckoutProps {
  formattedOutput: string
  currency?: RawCurrency
  outputUsd?: number
  actionLabel?: string
  actionDirection?: 'input' | 'destination'
  dstCurrency?: RawCurrency
  destinationActionLabel?: string
}

export function CurrencyReceiveCheckout({
  formattedOutput,
  currency,
  outputUsd,
  dstCurrency,
}: CurrencyReceiveCheckoutProps) {
  const effectiveCurrency = currency || dstCurrency
  return (
    <PayInfo
      label="You receive"
      currency={effectiveCurrency}
      amountUsd={outputUsd}
      amount={formattedOutput}
    />
  )
}
