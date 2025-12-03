import { useState, useMemo, useEffect, useRef } from 'react'
import { CurrencyHandler, SupportedChainId } from '../../../../sdk/types'
import { ActionHandler } from '../../shared/types'
import { buildCalls } from './callBuilder'
import { XCDOT_ADDRESS } from '../../../../lib/consts'
import type { RawCurrency } from '../../../../types/currency'
import { parseUnits } from 'viem'
import { reverseQuote } from '../../../../lib/reverseQuote'
import { useDebounce } from '../../../../hooks/useDebounce'
import { useConnection } from 'wagmi'
import { usePriceQuery } from '../../../../hooks/prices/usePriceQuery'
import { getCurrency } from '../../../../lib/trade-helpers/utils'
import { getTokenFromCache, isTokenListsReady } from '../../../../lib/data/tokenListsCache'

interface StellaStakingPanelProps {
  setDestinationInfo?: ActionHandler
  srcCurrency?: RawCurrency
  slippage?: number
  resetKey?: number
}

export function StellaStakingPanel({
  setDestinationInfo,
  srcCurrency,
  slippage = 0.5,
  resetKey,
}: StellaStakingPanelProps) {
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

  const xcDotCurrency = getCurrency(chainId, XCDOT_ADDRESS)
  const { data: pricesData } = usePriceQuery({
    currencies: [xcDotCurrency!, srcCurrency!],
    enabled: Boolean(srcCurrency && xcDotCurrency),
  })

  const xcDOTPrice = useMemo(() => {
    if (!pricesData || !xcDotCurrency) return undefined
    const chainId = xcDotCurrency.chainId
    const addressKey = xcDotCurrency.address?.toLowerCase()
    if (!chainId || !addressKey) return undefined
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, xcDotCurrency])

  const srcTokenPrice = useMemo(() => {
    if (!pricesData || !srcCurrency) return undefined
    const chainId = srcCurrency.chainId
    const addressKey = srcCurrency.address?.toLowerCase()
    if (!chainId || !addressKey) return undefined
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, srcCurrency])

  const calculatedInputAmount = useMemo(() => {
    if (!debouncedOutputAmount || !xcDOTToken) {
      return undefined
    }

    const amount = Number(debouncedOutputAmount)
    if (!amount || amount <= 0) {
      return undefined
    }

    if (xcDOTPrice === undefined || srcTokenPrice === undefined) {
      return undefined
    }

    try {
      const amountInWei = parseUnits(debouncedOutputAmount, xcDOTToken.decimals)
      const inputAmount = reverseQuote(
        xcDOTToken.decimals,
        amountInWei.toString(),
        srcTokenPrice,
        xcDOTPrice,
        slippage
      )
      return inputAmount
    } catch (error) {
      console.error('Error calculating reverse quote:', error)
      return undefined
    }
  }, [debouncedOutputAmount, xcDOTToken, xcDOTPrice, srcTokenPrice, slippage])

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
        setDestinationInfoRef.current(currencyAmount, undefined, destinationCalls, 'Staked DOT')
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
