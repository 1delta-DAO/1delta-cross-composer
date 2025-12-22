import { useState, useEffect, useMemo } from 'react'
import { type MoonwellMarket } from '../deposit/marketCache'
import { WithdrawActionModal } from './WithdrawModal'
import { WithdrawCard } from './WithdrawCard'
import { ActionHandler } from '../../shared/types'
import { useConnection } from 'wagmi'
import { useTokenLists } from '../../../../hooks/useTokenLists'
import type { RawCurrencyAmount } from '../../../../types/currency'

type WithdrawPanelProps = {
  chainId?: string
  setActionInfo?: ActionHandler
  resetKey?: number
  actionInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
  markets?: MoonwellMarket[]
}

export function WithdrawPanel({
  chainId,
  setActionInfo,
  resetKey,
  actionInfo,
  markets = [],
}: WithdrawPanelProps) {
  const { address } = useConnection()
  const [isExpanded, setIsExpanded] = useState(false)

  const withdrawMarkets = useMemo(() => {
    return markets.filter((m) => m.isListed && !m.borrowPaused)
  }, [markets])

  const [selectedMarket, setSelectedMarket] = useState<undefined | MoonwellMarket>(undefined)
  const [marketAmounts, setMarketAmounts] = useState<Map<string, string>>(new Map())
  const [lastSelectedMarketAddress, setLastSelectedMarketAddress] = useState<string | undefined>(
    undefined
  )

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setSelectedMarket(undefined)
      setIsExpanded(false)
      setMarketAmounts(new Map())
      setLastSelectedMarketAddress(undefined)
      setActionInfo?.(undefined, undefined, [])
    }
  }, [resetKey])

  const { data: list } = useTokenLists()

  const handleAmountChange = (marketAddress: string, amount: string) => {
    setMarketAmounts((prev) => {
      const next = new Map(prev)
      if (amount && amount.trim() !== '') {
        next.set(marketAddress, amount)
        setLastSelectedMarketAddress(marketAddress)
      } else {
        next.delete(marketAddress)
        if (lastSelectedMarketAddress === marketAddress) {
          setLastSelectedMarketAddress(undefined)
        }
      }
      return next
    })
  }

  const handleMarketClick = (market: MoonwellMarket) => {
    setSelectedMarket(market)
    setLastSelectedMarketAddress(market.mTokenCurrency.address)
  }

  if (markets.length === 0) {
    return (
      <div className="alert alert-warning">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>Moonwell markets are not available yet. Please wait for markets to load.</span>
      </div>
    )
  }

  return (
    <>
      <div className="card-body p-4">
        <div className="grid grid-cols-2 min-[600px]:grid-cols-3 min-[800px]:grid-cols-4 min-[1000px]:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto">
          {withdrawMarkets.length === 0 ? (
            <div className="col-span-full text-sm opacity-50 text-center py-4">
              No markets available
            </div>
          ) : (
            withdrawMarkets.map((market) => {
              const marketKey = market.mTokenCurrency.address
              const enteredAmount = marketAmounts.get(marketKey)
              const isSelected =
                lastSelectedMarketAddress === marketKey &&
                enteredAmount !== undefined &&
                enteredAmount.trim() !== '' &&
                Number(enteredAmount) > 0
              return (
                <WithdrawCard
                  key={marketKey}
                  market={market}
                  onActionClick={() => handleMarketClick(market)}
                  currencyFromList={
                    list[market.mTokenCurrency.chainId]?.[
                      market.underlyingCurrency.address.toLowerCase()
                    ]
                  }
                  underlyingCurrency={market.underlyingCurrency}
                  enteredAmount={isSelected ? enteredAmount : undefined}
                />
              )
            })
          )}
        </div>
      </div>

      {selectedMarket && (
        <WithdrawActionModal
          open={!!selectedMarket}
          market={selectedMarket}
          selectedCurrency={
            list[selectedMarket.mTokenCurrency.chainId]?.[
              selectedMarket.underlyingCurrency.address.toLowerCase()
            ]
          }
          onClose={() => setSelectedMarket(undefined)}
          userAddress={address as any}
          chainId={chainId}
          setActionInfo={setActionInfo}
          amount={marketAmounts.get(selectedMarket.mTokenCurrency.address) || ''}
          onAmountChange={(amount) =>
            handleAmountChange(selectedMarket.mTokenCurrency.address, amount)
          }
        />
      )}
    </>
  )
}

