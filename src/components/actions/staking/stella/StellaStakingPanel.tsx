import { useState, useMemo, useEffect } from 'react'
import { CurrencyHandler, SupportedChainId } from '../../../../sdk/types'
import { DestinationActionHandler } from '../../shared/types'
import { buildCalls } from './callBuilder'
import { XCDOT_ADDRESS } from '../../../../lib/consts'
import type { RawCurrency } from '../../../../types/currency'
import { parseUnits } from 'viem'
import { reverseQuote } from '../../../../lib/reverseQuote'
import { useDebounce } from '../../../../hooks/useDebounce'
import type { Address } from 'viem'
import { useTokenPrice } from '../../../../hooks/prices/useTokenPrice'
import { zeroAddress } from 'viem'
import { useConnection } from 'wagmi'

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals: number; address: string; chainId: string }>>

interface StellaStakingPanelProps {
  tokenLists?: TokenListsMeta
  setDestinationInfo?: DestinationActionHandler
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  slippage?: number
  resetKey?: number
}

export function StellaStakingPanel({ tokenLists, setDestinationInfo, srcCurrency, dstCurrency, slippage = 0.5, resetKey }: StellaStakingPanelProps) {
  const { address } = useConnection()

  const [outputAmount, setOutputAmount] = useState('')
  const [isSelected, setIsSelected] = useState(false)

  const chainId = SupportedChainId.MOONBEAM
  const debouncedOutputAmount = useDebounce(outputAmount, 1000)

  const xcDOTToken = useMemo(() => {
    if (!tokenLists || !chainId) return undefined
    return tokenLists[chainId]?.[XCDOT_ADDRESS.toLowerCase()]
  }, [tokenLists, chainId])

  const xcDOTCurrency = useMemo(() => {
    if (!xcDOTToken || !chainId) return undefined
    return {
      chainId: String(chainId),
      address: XCDOT_ADDRESS,
      decimals: xcDOTToken.decimals,
      symbol: xcDOTToken.symbol || 'XCDOT',
    } as RawCurrency
  }, [xcDOTToken, chainId])

  // Get price address for srcCurrency (handle native tokens)
  const srcTokenPriceAddr = useMemo(() => {
    if (!srcCurrency) return undefined
    if (srcCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(srcCurrency.chainId, zeroAddress) as Address | undefined
    }
    return srcCurrency.address as Address
  }, [srcCurrency])

  const shouldFetchXcDOTPrice = Boolean(chainId && outputAmount && Number(outputAmount) > 0)
  const shouldFetchSrcTokenPrice = Boolean(srcCurrency && srcTokenPriceAddr && outputAmount && Number(outputAmount) > 0)

  const { price: xcDOTPrice } = useTokenPrice({
    chainId: String(chainId),
    tokenAddress: XCDOT_ADDRESS,
    enabled: shouldFetchXcDOTPrice,
  })

  const { price: srcTokenPrice } = useTokenPrice({
    chainId: srcCurrency?.chainId || '',
    tokenAddress: srcTokenPriceAddr,
    enabled: shouldFetchSrcTokenPrice,
  })

  const calculatedInputAmount = useMemo(() => {
    if (!debouncedOutputAmount || !xcDOTToken) {
      return undefined
    }

    const amount = Number(debouncedOutputAmount)
    if (!amount || amount <= 0) {
      return undefined
    }

    // We need DOT (xcDOT) price and source token price for reverse quote
    if (xcDOTPrice === undefined || srcTokenPrice === undefined) {
      return undefined
    }

    try {
      // User enters DOT amount (output), we calculate how much source token (input) is needed
      // reverseQuote(decimalsOut, amountOut, priceIn, priceOut)
      // - decimalsOut: DOT/xcDOT decimals
      // - amountOut: DOT amount in wei
      // - priceIn: source token price
      // - priceOut: DOT/xcDOT price
      const amountInWei = parseUnits(debouncedOutputAmount, xcDOTToken.decimals)
      const inputAmount = reverseQuote(xcDOTToken.decimals, amountInWei.toString(), srcTokenPrice, xcDOTPrice, slippage)
      return inputAmount
    } catch (error) {
      console.error('Error calculating reverse quote:', error)
      return undefined
    }
  }, [debouncedOutputAmount, xcDOTToken, xcDOTPrice, srcTokenPrice, slippage])


  useEffect(() => {
    const autoSelect = async () => {
      if (!debouncedOutputAmount || !xcDOTToken || !address || isSelected) return

      const amount = Number(debouncedOutputAmount)
      if (!amount || amount <= 0) {
        if (setDestinationInfo) {
          setDestinationInfo(undefined, undefined, [])
        }
        return
      }

      const destinationCalls = await buildCalls({
        userAddress: address as any,
      })

      if (setDestinationInfo) {
        const outputAmountWei = parseUnits(debouncedOutputAmount, xcDOTToken.decimals)
        const currencyAmount = CurrencyHandler.fromRawAmount(xcDOTToken, outputAmountWei.toString())

        setDestinationInfo(currencyAmount, undefined, destinationCalls, 'Staked DOT')
        setIsSelected(true)
        setTimeout(() => setIsSelected(false), 1000)
      }
    }

    autoSelect()
  }, [debouncedOutputAmount, xcDOTToken, address, isSelected, setDestinationInfo])

  const handleAmountChange = (value: string) => {
    setOutputAmount(value)
    setIsSelected(false)
    if (!value || Number(value) <= 0) {
      setDestinationInfo?.(undefined, undefined, [])
    }
  }

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setOutputAmount('')
      setIsSelected(false)
      setDestinationInfo?.(undefined, undefined, [])
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

        {calculatedInputAmount && srcCurrency && outputAmount && Number(outputAmount) > 0 && (
          <div className="text-xs text-success">
            ✓ Requires ~{Number(calculatedInputAmount).toFixed(6)} {srcCurrency.symbol || 'tokens'}
          </div>
        )}
      </div>
    </div>
  )
}
