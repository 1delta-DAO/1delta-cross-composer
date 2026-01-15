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

  const [open, setOpen] = useState(false)

  const tokens: any = {
    DOT: xcDOTToken,
    GLMR: glmrToken,
  }

  const selectedToken = tokens[tokenType]

  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2 rounded-xl border border-base-300 bg-base-100 p-2 focus-within:border-primary transition">
        {/* Amount Input */}
        <input
          className="flex-1 bg-transparent outline-none text-lg font-medium placeholder:text-base-content/40"
          placeholder={`${tokenType} amount`}
          value={outputAmount}
          onChange={(e) => handleAmountChange(e.target.value)}
          inputMode="decimal"
        />

        {/* Token Selector */}
        <div className="relative" ref={wrapperRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-base-200 px-3 py-2 hover:bg-base-300 transition"
          >
            <Logo
              src={selectedToken?.logoURI}
              alt={''}
              fallbackText={selectedToken?.symbol?.[0] || tokenType}
              size={18}
            />
            <span className="font-semibold">{tokenType}</span>
            {/* CSS Arrow */}
            <span
              className={`ml-1 inline-block h-0 w-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-base-content/60 transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />{' '}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full z-10 mt-2 w-36 rounded-xl border border-base-300 bg-base-100 shadow-lg overflow-hidden">
              {(Object.keys(tokens) as any[]).map((key) => {
                const token = tokens[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTokenType(key)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200 transition ${
                      key === tokenType ? 'bg-primary/10 font-semibold' : ''
                    }`}
                  >
                    <Logo
                      src={token?.logoURI}
                      alt={token?.symbol}
                      fallbackText={token?.symbol?.[0] || key}
                      size={16}
                    />
                    <span>{key}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
