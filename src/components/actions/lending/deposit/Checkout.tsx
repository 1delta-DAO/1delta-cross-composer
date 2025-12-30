import { RawCurrency } from '@1delta/lib-utils'
import { Logo } from '../../../common/Logo'
import { useActionData } from '../../../../contexts/DestinationInfoContext'
import { getChainLogo } from '@1delta/lib-utils'
import { useChainsRegistry } from '../../../../sdk/hooks/useChainsRegistry'
import { useMemo } from 'react'

const getLenderUri = (protocol: string) => {
  const lc = protocol.toLowerCase()
  return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/main/lender/${lc}.webp`
}

interface DepositCheckoutProps {
  formattedOutput: string
  currency?: RawCurrency
  outputUsd?: number
  actionLabel?: string
  actionDirection?: 'input' | 'destination'
  dstCurrency?: RawCurrency
  destinationActionLabel?: string
}

export function DepositCheckout({
  formattedOutput,
  currency,
  outputUsd,
  dstCurrency,
}: DepositCheckoutProps) {
  const actionData = useActionData()
  if (!actionData || !actionData.lender) return null

  const { data: chains } = useChainsRegistry()
  const effectiveCurrency = currency || dstCurrency

  const formattedUsd =
    outputUsd !== undefined && isFinite(outputUsd) ? `$${outputUsd.toFixed(2)}` : undefined

  const chainName = useMemo(() => {
    if (!effectiveCurrency?.chainId || !chains) return effectiveCurrency?.chainId
    return chains[effectiveCurrency.chainId]?.data?.name || effectiveCurrency.chainId
  }, [effectiveCurrency?.chainId, chains])

  const chainLogo = getChainLogo(effectiveCurrency?.chainId)

  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-base-100 border border-base-300">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold opacity-70">Deposit {effectiveCurrency?.symbol} to</span>
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
          <Logo
            src={effectiveCurrency?.logoURI}
            alt={effectiveCurrency?.symbol ?? '--'}
            fallbackText={effectiveCurrency?.symbol}
            className="h-6 w-6 rounded-full"
          />
          <div className="text-lg font-semibold">
            {formattedOutput} {effectiveCurrency?.symbol}
          </div>
        </div>

        {formattedUsd && <div className="text-xs opacity-70">≈ {formattedUsd} USD</div>}
      </div>
    </div>
  )
}

