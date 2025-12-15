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
  if (!actionData || !actionData.lst) return null

  const formattedUsd =
    outputUsd !== undefined && isFinite(outputUsd) ? `$${outputUsd.toFixed(2)}` : undefined

  const chainLogo = getChainLogo(actionData.lst.chainId)

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
