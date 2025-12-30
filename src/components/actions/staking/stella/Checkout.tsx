import { RawCurrency } from '@1delta/lib-utils'
import { Logo } from '../../../common/Logo'
import { useActionData } from '../../../../contexts/DestinationInfoContext'
import { getChainLogo } from '@1delta/lib-utils'
import { useChainsRegistry } from '../../../../sdk/hooks/useChainsRegistry'
import { useMemo } from 'react'

interface StakingCheckoutProps {
  formattedOutput: string
  currency?: RawCurrency
  outputUsd?: number
  actionLabel?: string
  actionDirection?: 'input' | 'destination'
  dstCurrency?: RawCurrency
  destinationActionLabel?: string
}

export function StakingCheckout({
  formattedOutput,
  currency,
  outputUsd,
  dstCurrency,
}: StakingCheckoutProps) {
  const actionData = useActionData()
  const { data: chains } = useChainsRegistry()
  if (!actionData || !actionData.lst) return null

  const formattedUsd =
    outputUsd !== undefined && isFinite(outputUsd) ? `$${outputUsd.toFixed(2)}` : undefined

  const chainId = actionData.lst.chainId
  const chainLogo = getChainLogo(chainId)

  const chainName = useMemo(() => {
    if (!chainId || !chains) return chainId
    return chains[chainId]?.data?.name || chainId
  }, [chainId, chains])

  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-base-100 border border-base-300">
      {/* Token Conversion Row */}
      <div className="flex items-center gap-2">
        {/* Staked token */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold opacity-70">
            Stake {actionData.stakingToken.symbol} and receive
          </span>
          <Logo
            src={actionData.lst.logoURI}
            alt={actionData.lst.symbol}
            fallbackText={actionData.lst.symbol}
            className="h-4 w-4 rounded-full"
          />
          <div className="text-sm font-medium">{actionData.lst.symbol}</div>
        </div>

        {/* Chain info */}
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

      {/* Amount row */}
      <div className="rounded-lg bg-base-100 p-1">
        <div className="flex items-center gap-2">
          <Logo
            src={actionData.stakingToken.logoURI}
            alt={actionData.stakingToken.symbol}
            fallbackText={actionData.stakingToken.symbol}
            className="h-6 w-6 rounded-full"
          />
          <div className="text-lg font-semibold">
            {formattedOutput} {actionData.stakingToken.symbol}
          </div>
        </div>

        {formattedUsd && <div className="text-xs opacity-70">≈ {formattedUsd} USD</div>}
      </div>
    </div>
  )
}
