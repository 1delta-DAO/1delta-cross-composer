import { useState, useCallback, useMemo } from 'react'
import type { RawCurrency } from '../../../types/currency'
import { zeroAddress } from 'viem'
import { Logo } from '../../common/Logo'
import { TokenSelectorModal } from '../../modals/TokenSelectorModal'
import { useTokenLists } from '../../../hooks/useTokenLists'

interface DestinationTokenSelectorProps {
  dstCurrency?: RawCurrency
  onCurrencyChange: (currency: RawCurrency) => void
  onChainChange?: (chainId: string) => void
  chains?: Record<string, { data?: { name?: string } }>
  isReverseFlow?: boolean
}

export function DestinationTokenSelector({
  dstCurrency,
  onCurrencyChange,
  onChainChange,
  chains,
  isReverseFlow = false,
}: DestinationTokenSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: tokenLists } = useTokenLists()

  const chainName = useMemo(
    () => dstCurrency?.chainId && chains?.[dstCurrency.chainId]?.data?.name,
    [dstCurrency?.chainId, chains]
  )
  const tokenInfo = useMemo(
    () =>
      dstCurrency?.chainId && dstCurrency?.address
        ? tokenLists?.[dstCurrency.chainId]?.[dstCurrency.address.toLowerCase()]
        : undefined,
    [dstCurrency?.chainId, dstCurrency?.address, tokenLists]
  )

  const handleTokenSelect = useCallback(
    (currency: RawCurrency) => {
      onCurrencyChange(currency)
      setModalOpen(false)
    },
    [onCurrencyChange]
  )

  const handleChainSelect = useCallback(
    (chainId: string) => {
      onChainChange?.(chainId)
      onCurrencyChange({ chainId: chainId, address: zeroAddress, decimals: 18 })
    },
    [onChainChange, onCurrencyChange]
  )

  const handleModalClose = useCallback(() => {
    setModalOpen(false)
  }, [])

  const handleModalOpen = useCallback(() => {
    setModalOpen(true)
  }, [])

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline flex items-center gap-2"
        onClick={handleModalOpen}
      >
        {dstCurrency ? (
          <>
            <Logo
              src={tokenInfo?.logoURI}
              alt={dstCurrency.symbol || 'Token'}
              size={16}
              fallbackText={dstCurrency.symbol?.[0] || 'T'}
            />
            <span className="text-sm">{dstCurrency.symbol || 'Token'}</span>
            {chainName && <span className="text-xs opacity-70">on {chainName}</span>}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 opacity-70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        ) : (
          <>
            <span className="text-sm">
              {isReverseFlow ? 'Select token to receive' : 'Select destination token'}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 opacity-70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      <TokenSelectorModal
        open={modalOpen}
        onClose={handleModalClose}
        currency={dstCurrency}
        onCurrencyChange={handleTokenSelect}
        onChainChange={handleChainSelect}
        query={query}
        onQueryChange={setQuery}
        showChainSelector={true}
      />
    </>
  )
}

