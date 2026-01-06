import { RawCurrency } from '@1delta/lib-utils'
import { Logo } from '../../../common/Logo'
import { useActionData } from '../../../../contexts/DestinationInfoContext'
import { getChainLogo } from '@1delta/lib-utils'
import { getMarketByMToken } from '../shared/marketCache'
import { useChainsRegistry } from '../../../../sdk/hooks/useChainsRegistry'
import { useMemo } from 'react'
import { PayInfo } from '../../../transactionSummary/PayInfo'
import { formatDisplayAmount } from '../../../actionsTab/swapUtils'

const getLenderUri = (protocol: string) => {
  const lc = protocol.toLowerCase()
  return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/main/lender/${lc}.webp`
}

interface WithdrawCheckoutProps {
  formattedOutput: string
  currency?: RawCurrency
  outputUsd?: number
  actionLabel?: string
  actionDirection?: 'input' | 'destination'
  dstCurrency?: RawCurrency
  destinationActionLabel?: string
}

export function WithdrawCheckout({
  formattedOutput,
  currency,
  outputUsd,
  actionLabel,
  dstCurrency,
  destinationActionLabel,
}: WithdrawCheckoutProps) {
  const actionData = useActionData()
  if (!actionData || !actionData.lender) return null

  const { data: chains } = useChainsRegistry()
  const effectiveCurrency = currency || dstCurrency
  const effectiveActionLabel = actionLabel || destinationActionLabel

  const chainName = useMemo(() => {
    if (!effectiveCurrency?.chainId || !chains) return effectiveCurrency?.chainId
    return chains[effectiveCurrency.chainId]?.data?.name || effectiveCurrency.chainId
  }, [effectiveCurrency?.chainId, chains])

  const chainLogo = getChainLogo(effectiveCurrency?.chainId)

  const mTokenMarket = useMemo(() => {
    if (actionData?.mTokenAddress) {
      return getMarketByMToken(actionData.mTokenAddress)
    }
    return undefined
  }, [actionData?.mTokenAddress])

  const mTokenSymbol = useMemo(() => {
    if (mTokenMarket) {
      return mTokenMarket.mTokenCurrency?.symbol || 'mToken'
    }
    if (effectiveActionLabel) {
      return effectiveActionLabel.replace(/\s+withdraw$/i, '')
    }
    return 'mToken'
  }, [mTokenMarket, effectiveActionLabel])

  const mTokenAmount = useMemo(() => {
    if (!mTokenMarket || !effectiveCurrency || !formattedOutput || !mTokenMarket.exchangeRate) {
      return undefined
    }

    try {
      const underlyingAmount = parseFloat(formattedOutput.replace(/,/g, ''))
      if (isNaN(underlyingAmount) || underlyingAmount <= 0) return undefined

      const underlyingDecimals = effectiveCurrency.decimals || 18
      const exchangeRate = mTokenMarket.exchangeRate

      const underlyingAmountWei = BigInt(Math.floor(underlyingAmount * 10 ** underlyingDecimals))
      const oneE18 = BigInt(10 ** 18)

      const mTokenAmountWei = (underlyingAmountWei * oneE18) / exchangeRate
      const mTokenDecimals = mTokenMarket.mTokenCurrency.decimals || 18
      const mTokenAmountHuman = Number(mTokenAmountWei) / 10 ** mTokenDecimals

      return formatDisplayAmount(mTokenAmountHuman.toString())
    } catch (error) {
      console.error('Error calculating mToken amount:', error)
      return undefined
    }
  }, [mTokenMarket, effectiveCurrency, formattedOutput])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 p-3 rounded-xl bg-base-100 border border-base-300">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold opacity-70">
              Withdrawing {mTokenSymbol} from
            </span>
            <Logo
              src={getLenderUri(actionData.lender)}
              alt={actionData.lender}
              fallbackText={actionData.lender}
              className="h-4 w-4 rounded-full"
            />
            <div className="text-sm font-medium">{actionData.lender}</div>
          </div>

          {chainName && (
            <div className="flex items-center gap-1 text-xs opacity-70">
              <span>on {chainName}</span>
              {chainLogo && (
                <Logo
                  src={chainLogo}
                  alt={chainName}
                  className="h-4 w-4 rounded-full"
                  fallbackText={chainName[0]}
                />
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-base-100 p-1">
          <div className="flex items-center gap-2">
            {mTokenMarket?.mTokenCurrency ? (
              <>
                <Logo
                  src={mTokenMarket.mTokenCurrency.logoURI}
                  alt={mTokenMarket.mTokenCurrency.symbol ?? '--'}
                  fallbackText={mTokenMarket.mTokenCurrency.symbol}
                  className="h-6 w-6 rounded-full"
                />
                <div className="text-lg font-semibold">
                  {mTokenAmount || formattedOutput} {mTokenMarket.mTokenCurrency.symbol}
                </div>
              </>
            ) : (
              <>
                {effectiveCurrency?.logoURI && (
                  <Logo
                    src={effectiveCurrency.logoURI}
                    alt={effectiveCurrency.symbol ?? '--'}
                    fallbackText={effectiveCurrency.symbol}
                    className="h-6 w-6 rounded-full"
                  />
                )}
                <div className="text-lg font-semibold">
                  {formattedOutput} {mTokenSymbol}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <PayInfo
        label="You'll receive:"
        currency={effectiveCurrency}
        amountUsd={outputUsd}
        amount={formattedOutput}
      />
    </div>
  )
}
