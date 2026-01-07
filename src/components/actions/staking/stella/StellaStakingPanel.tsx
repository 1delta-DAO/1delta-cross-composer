import { useState, useMemo, useEffect, useRef } from 'react'
import { CurrencyHandler, SupportedChainId } from '../../../../sdk/types'
import { ActionHandler } from '../../shared/types'
import { buildCalls } from './callBuilder'
import { STELLA_STDOT_ADDRESS, STELLA_STGLMR_ADDRESS } from './consts'
import { parseUnits, zeroAddress } from 'viem'
import { useDebounce } from '../../../../hooks/useDebounce'
import { useConnection } from 'wagmi'
import {
  getTokenFromCache,
  isTokenListsReady,
  getTokenListsCache,
} from '../../../../lib/data/tokenListsCache'
import { Logo } from '../../../../components/common/Logo'

interface StellaStakingPanelProps {
  setActionInfo?: ActionHandler
  resetKey?: number
}

export function StellaStakingPanel({ setActionInfo, resetKey }: StellaStakingPanelProps) {
  const { address } = useConnection()

  const [outputAmount, setOutputAmount] = useState('')
  const [tokenType, setTokenType] = useState<'DOT' | 'GLMR'>('DOT')
  const lastDestinationKeyRef = useRef<string | null>(null)
  const setActionInfoRef = useRef(setActionInfo)

  useEffect(() => {
    setActionInfoRef.current = setActionInfo
  }, [setActionInfo])

  const chainId = SupportedChainId.MOONBEAM
  const debouncedOutputAmount = useDebounce(outputAmount, 1000)

  const xcDOTToken = useMemo(() => {
    if (!chainId || !isTokenListsReady()) return undefined
    const tokensMap = getTokenListsCache()?.[String(chainId)]
    if (!tokensMap) return undefined
    return tokensMap['0xffffffff1fcacbd218edc0eba20fc2308c778080']
  }, [chainId])

  const glmrToken = useMemo(() => {
    if (!chainId || !isTokenListsReady()) return undefined
    const tokensMap = getTokenListsCache()?.[String(chainId)]
    if (!tokensMap) return undefined
    return tokensMap[zeroAddress]
  }, [chainId])

  useEffect(() => {
    const autoSelect = async () => {
      const selectedToken = tokenType === 'DOT' ? xcDOTToken : glmrToken
      if (!debouncedOutputAmount || !selectedToken || !address) {
        if (lastDestinationKeyRef.current !== null) {
          lastDestinationKeyRef.current = null
          setActionInfoRef.current?.(undefined, undefined, [])
        }
        return
      }

      const amount = Number(debouncedOutputAmount)
      if (!amount || amount <= 0) {
        if (lastDestinationKeyRef.current !== null) {
          lastDestinationKeyRef.current = null
          setActionInfoRef.current?.(undefined, undefined, [])
        }
        return
      }

      const destinationCalls = await buildCalls({
        userAddress: address as any,
        tokenType,
        xcDOTAddress:
          tokenType === 'DOT' && xcDOTToken ? (xcDOTToken.address as any) : (zeroAddress as any),
      })

      const outputAmountWei = parseUnits(debouncedOutputAmount, selectedToken.decimals)
      const currencyAmount = CurrencyHandler.fromRawAmount(
        selectedToken,
        outputAmountWei.toString()
      )
      const destinationKey = `${currencyAmount.currency.chainId}-${currencyAmount.currency.address}-${currencyAmount.amount.toString()}-${destinationCalls.length}-${tokenType}`

      if (lastDestinationKeyRef.current !== destinationKey) {
        lastDestinationKeyRef.current = destinationKey
        const lstAddress = tokenType === 'DOT' ? STELLA_STDOT_ADDRESS : STELLA_STGLMR_ADDRESS
        const lstToken = getTokenFromCache(String(chainId), lstAddress)
        setActionInfoRef.current?.(
          currencyAmount,
          undefined,
          destinationCalls,
          tokenType === 'DOT' ? 'Staked DOT' : 'Staked GLMR',
          undefined,
          {
            stakingToken: selectedToken,
            lst: lstToken,
          }
        )
      }
    }

    autoSelect()
  }, [debouncedOutputAmount, xcDOTToken, glmrToken, address, tokenType, chainId])

  const handleAmountChange = (value: string) => {
    setOutputAmount(value)
    if (!value || Number(value) <= 0) {
      lastDestinationKeyRef.current = null
      setActionInfoRef.current?.(undefined, undefined, [])
    }
  }

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setOutputAmount('')
      setTokenType('DOT')
      lastDestinationKeyRef.current = null
      setActionInfoRef.current?.(undefined, undefined, [])
    }
  }, [resetKey])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder={`${tokenType} amount`}
            value={outputAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
            inputMode="decimal"
          />
          <select
            defaultValue={tokenType}
            className="select select-primary"
            onChange={(e) => {
              setTokenType(e.target.value as 'DOT' | 'GLMR')
              setOutputAmount('')
            }}
          >
            <option value="DOT">
              <>
                <Logo
                  src={xcDOTToken?.logoURI}
                  alt={xcDOTToken?.symbol || 'DOT'}
                  fallbackText={xcDOTToken?.symbol?.[0] || 'DOT'}
                  size={16}
                />
                <span>DOT</span>
              </>
            </option>
            <option value="GLMR">
              <>
                <Logo
                  src={glmrToken?.logoURI}
                  alt={glmrToken?.symbol || 'GLMR'}
                  fallbackText={glmrToken?.symbol?.[0] || 'GLMR'}
                  size={16}
                />
                <span>GLMR</span>
              </>
            </option>
          </select>
        </div>
      </div>
    </div>
  )
}
