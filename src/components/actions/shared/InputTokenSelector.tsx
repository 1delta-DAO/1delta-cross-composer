import { useState, useCallback, useMemo } from 'react'
import type { RawCurrency } from '../../../types/currency'
import { zeroAddress } from 'viem'
import { Logo } from '../../common/Logo'
import { TokenSelectorModal } from '../../modals/TokenSelectorModal'

interface InputTokenSelectorProps {
  srcCurrency?: RawCurrency
  onCurrencyChange: (currency: RawCurrency) => void
  onChainChange?: (chainId: string) => void
  tokenLists?: Record<string, Record<string, RawCurrency>>
  chains?: Record<string, { data?: { name?: string } }>
}

export function InputTokenSelector({
  srcCurrency,
  onCurrencyChange,
  onChainChange,
  tokenLists,
  chains,
}: InputTokenSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')

  const chainName = useMemo(
    () => srcCurrency?.chainId && chains?.[srcCurrency.chainId]?.data?.name,
    [srcCurrency?.chainId, chains]
  )
  const tokenInfo = useMemo(
    () =>
      srcCurrency?.chainId && srcCurrency?.address
        ? tokenLists?.[srcCurrency.chainId]?.[srcCurrency.address.toLowerCase()]
        : undefined,
    [srcCurrency?.chainId, srcCurrency?.address, tokenLists]
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
        {srcCurrency ? (
          <>
            <Logo
              src={tokenInfo?.logoURI}
              alt={srcCurrency.symbol || 'Token'}
              size={16}
              fallbackText={srcCurrency.symbol?.[0] || 'T'}
            />
            <span className="text-sm">{srcCurrency.symbol || 'Token'}</span>
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
            <span className="text-sm">Select payment token</span>
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
        currency={srcCurrency}
        onCurrencyChange={handleTokenSelect}
        onChainChange={handleChainSelect}
        query={query}
        onQueryChange={setQuery}
        showChainSelector={true}
      />
    </>
  )
}
