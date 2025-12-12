import { RawCurrency } from '@1delta/lib-utils'
import { PayInfo } from '../../transactionSummary/PayInfo'

interface CurrencyReceiveCheckoutProps {
  formattedOutput: string
  dstCurrency?: RawCurrency
  dstChainName?: string
  outputUsd?: number
}

export function CurrencyReceiveCheckout({
  formattedOutput,
  dstCurrency,
  dstChainName,
  outputUsd,
}: CurrencyReceiveCheckoutProps) {
  return (
    <PayInfo
      label="You receive"
      currency={dstCurrency}
      chainName={dstChainName}
      amountUsd={outputUsd}
      amount={formattedOutput}
    />
  )
}
