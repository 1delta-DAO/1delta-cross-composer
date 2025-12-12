import { RawCurrency } from '@1delta/lib-utils'
import { Logo } from '../../../common/Logo'
import { useActionData } from '../../../../contexts/DestinationInfoContext'
import { getChainLogo } from '@1delta/lib-utils'

interface StakingCheckoutProps {
  formattedOutput: string
  dstCurrency?: RawCurrency
  dstChainName?: string
  outputUsd?: number
  destinationActionLabel?: string
}

export function StakingCheckout({
  formattedOutput,
  dstCurrency,
  dstChainName,
  outputUsd,
  destinationActionLabel,
}: StakingCheckoutProps) {
  const actionData = useActionData()
  if (!actionData) return null

  const formattedUsd =
    outputUsd !== undefined && isFinite(outputUsd) ? `$${outputUsd.toFixed(2)}` : undefined

  const chainLogo = getChainLogo(actionData.lst.chainId)

  return (
    <div className="space-y-4 p-4 border border-base-300 rounded-xl bg-base-200">
      <div className="text-sm font-semibold">Staking Summary</div>

      {/* Token Conversion Row */}
      <div className="flex items-center gap-2">
        {/* Staked token */}
        <div className="flex items-center gap-2">
          <span>Stake</span>
          <Logo
            src={actionData.lst.logoURI}
            alt={actionData.lst.symbol}
            fallbackText={actionData.lst.symbol}
            className="h-6 w-6 rounded-full"
          />
          <div className="text-sm font-medium">{actionData.lst.symbol}</div>
        </div>

        {/* Chain info */}
        {dstChainName && (
          <div className="flex items-center gap-1 text-xs opacity-70">
            <span>on {dstChainName}</span>
            {chainLogo && (
              <Logo
                src={chainLogo}
                alt={dstChainName}
                className="h-4 w-4 rounded-full"
                fallbackText={dstChainName[0]}
              />
            )}
          </div>
        )}
      </div>

      {/* Amount row */}
      <div className="rounded-lg bg-base-100 border border-base-300 p-3">
        <div className="text-xs opacity-60">Staked amount</div>
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

      {/* Destination Label */}
      {destinationActionLabel && (
        <div className="text-xs opacity-60 pt-1">Action: {destinationActionLabel}</div>
      )}
    </div>
  )
}
