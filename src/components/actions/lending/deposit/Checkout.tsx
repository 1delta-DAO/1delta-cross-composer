import { RawCurrency } from '@1delta/lib-utils'
import { Logo } from '../../../common/Logo'
import { useActionData } from '../../../../contexts/DestinationInfoContext'
import { getChainLogo } from '@1delta/lib-utils'

const getLenderUri = (protocol: string) => {
  const lc = protocol.toLowerCase()
  return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/main/lender/${lc}.webp`
}

interface LendingCheckoutProps {
  formattedOutput: string
  dstCurrency?: RawCurrency
  dstChainName?: string
  outputUsd?: number
  destinationActionLabel?: string
}

export function LendingCheckout({
  formattedOutput,
  dstCurrency,
  dstChainName,
  outputUsd,
  destinationActionLabel,
}: LendingCheckoutProps) {
  const actionData = useActionData()
  if (!actionData || !actionData.lender) return null

  const formattedUsd =
    outputUsd !== undefined && isFinite(outputUsd) ? `$${outputUsd.toFixed(2)}` : undefined

  const chainLogo = getChainLogo(dstCurrency?.chainId)

  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-base-100 border border-base-300">
      {/* Token Conversion Row */}
      <div className="flex items-center gap-2">
        {/* Staked token */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold opacity-70">Deposit {dstCurrency?.symbol} to</span>
          <Logo
            src={getLenderUri(actionData.lender)}
            alt={actionData.lender}
            fallbackText={actionData.lender}
            className="h-4 w-4 rounded-full"
          />
          <div className="text-sm font-medium">{actionData.lender}</div>
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
            src={dstCurrency?.logoURI}
            alt={dstCurrency?.symbol ?? '--'}
            fallbackText={dstCurrency?.symbol}
            className="h-6 w-6 rounded-full"
          />
          <div className="text-lg font-semibold">
            {formattedOutput} {dstCurrency?.symbol}
          </div>
        </div>

        {formattedUsd && <div className="text-xs opacity-70">≈ {formattedUsd} USD</div>}
      </div>
    </div>
  )
}
