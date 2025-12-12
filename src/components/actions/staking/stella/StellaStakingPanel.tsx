import { useState, useMemo, useEffect, useRef } from 'react'
import { CurrencyHandler, SupportedChainId } from '../../../../sdk/types'
import { ActionHandler } from '../../shared/types'
import { buildCalls } from './callBuilder'
import { STELLA_STDOT_ADDRESS, XCDOT_ADDRESS } from './consts'
import { parseUnits } from 'viem'
import { useDebounce } from '../../../../hooks/useDebounce'
import { useConnection } from 'wagmi'
import { getTokenFromCache, isTokenListsReady } from '../../../../lib/data/tokenListsCache'

interface StellaStakingPanelProps {
  setDestinationInfo?: ActionHandler
  resetKey?: number
}

export function StellaStakingPanel({ setDestinationInfo, resetKey }: StellaStakingPanelProps) {
  const { address } = useConnection()

  const [outputAmount, setOutputAmount] = useState('')
  const lastDestinationKeyRef = useRef<string | null>(null)
  const setDestinationInfoRef = useRef(setDestinationInfo)

  useEffect(() => {
    setDestinationInfoRef.current = setDestinationInfo
  }, [setDestinationInfo])

  const chainId = SupportedChainId.MOONBEAM
  const debouncedOutputAmount = useDebounce(outputAmount, 1000)

  const xcDOTToken = useMemo(() => {
    if (!chainId || !isTokenListsReady()) return undefined
    return getTokenFromCache(String(chainId), XCDOT_ADDRESS)
  }, [chainId])

  useEffect(() => {
    const autoSelect = async () => {
      if (!debouncedOutputAmount || !xcDOTToken || !address) {
        if (lastDestinationKeyRef.current !== null) {
          lastDestinationKeyRef.current = null
          setDestinationInfoRef.current?.(undefined, undefined, [])
        }
        return
      }

      const amount = Number(debouncedOutputAmount)
      if (!amount || amount <= 0) {
        if (lastDestinationKeyRef.current !== null) {
          lastDestinationKeyRef.current = null
          setDestinationInfoRef.current?.(undefined, undefined, [])
        }
        return
      }

      const destinationCalls = await buildCalls({
        userAddress: address as any,
      })

      const outputAmountWei = parseUnits(debouncedOutputAmount, xcDOTToken.decimals)
      const currencyAmount = CurrencyHandler.fromRawAmount(xcDOTToken, outputAmountWei.toString())
      const destinationKey = `${currencyAmount.currency.chainId}-${currencyAmount.currency.address}-${currencyAmount.amount.toString()}-${destinationCalls.length}`

      if (lastDestinationKeyRef.current !== destinationKey) {
        lastDestinationKeyRef.current = destinationKey
        setDestinationInfoRef.current?.(
          currencyAmount,
          undefined,
          destinationCalls,
          'Staked DOT',
          undefined,
          {
            stakingToken: xcDOTToken,
            lst: getTokenFromCache(String(chainId), STELLA_STDOT_ADDRESS),
          }
        )
      }
    }

    autoSelect()
  }, [debouncedOutputAmount, xcDOTToken, address])

  const handleAmountChange = (value: string) => {
    setOutputAmount(value)
    if (!value || Number(value) <= 0) {
      lastDestinationKeyRef.current = null
      setDestinationInfoRef.current?.(undefined, undefined, [])
    }
  }

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setOutputAmount('')
      lastDestinationKeyRef.current = null
      setDestinationInfoRef.current?.(undefined, undefined, [])
    }
  }, [resetKey])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="DOT amount"
            value={outputAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
            inputMode="decimal"
          />
        </div>
      </div>
    </div>
  )
}
