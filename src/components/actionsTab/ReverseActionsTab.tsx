import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useChainId, useConnection } from 'wagmi'
import { useChainsRegistry } from '../../sdk/hooks/useChainsRegistry'
import { useTokenLists } from '../../hooks/useTokenLists'
import { usePriceQuery } from '../../hooks/prices/usePriceQuery'
import { CurrencyHandler, SupportedChainId } from '../../sdk/types'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { useSlippage } from '../../contexts/SlippageContext'
import { ReverseActionsPanel } from './ReverseActionsPanel'
import type { ActionCall } from '../actions/shared/types'
import { ActionHandler } from '../actions/shared/types'
import { useQuoteTrace } from '../../contexts/QuoteTraceContext'

type Props = {
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}

const DEFAULT_DESTINATION_CHAIN_ID = SupportedChainId.BASE

export function ReverseActionsTab({ onResetStateChange }: Props) {
  const { address } = useConnection()
  const { data: chains } = useChainsRegistry()
  const { data: lists } = useTokenLists()
  const currentChainId = useChainId()

  const [destinationCurrency, setDestinationCurrency] = useState<RawCurrency | undefined>(undefined)
  const [inputActionCurrency, setInputActionCurrency] = useState<RawCurrency | undefined>(undefined)
  const [inputCalls, setInputCalls] = useState<ActionCall[]>([])
  const [inputInfo, setInputInfoState] = useState<
    { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string } | undefined
  >(undefined)
  const [actionResetKey, setActionResetKey] = useState(0)

  const destinationChainId = destinationCurrency?.chainId ?? DEFAULT_DESTINATION_CHAIN_ID
  const inputActionChainId = inputActionCurrency?.chainId

  useEffect(() => {
    if (destinationCurrency || !lists || !chains) return
    const native = chains?.[DEFAULT_DESTINATION_CHAIN_ID]?.data?.nativeCurrency?.symbol
    const force = DEFAULT_DESTINATION_CHAIN_ID === SupportedChainId.BASE ? 'USDC' : undefined
    const tokensMap = lists[DEFAULT_DESTINATION_CHAIN_ID] || {}
    const pick = Object.keys(tokensMap).find((addr) => {
      const token = tokensMap[addr.toLowerCase()]
      return token?.symbol === (force || native)
    })
    if (!pick) return
    const meta = tokensMap[pick.toLowerCase()]
    if (!meta) return
    setDestinationCurrency(meta)
  }, [destinationCurrency, lists, chains])

  const allCurrenciesForPrice = useMemo(() => {
    const currencies: RawCurrency[] = []
    const seenKeys = new Set<string>()

    const addCurrency = (currency?: RawCurrency) => {
      if (!currency) return
      const key = `${currency.chainId}-${currency.address.toLowerCase()}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        currencies.push(currency)
      }
    }

    addCurrency(destinationCurrency)
    addCurrency(inputActionCurrency)

    return currencies
  }, [destinationCurrency, inputActionCurrency])

  const {
    data: pricesData,
    isLoading: isLoadingPrices,
    isFetching: isFetchingPrices,
  } = usePriceQuery({
    currencies: allCurrenciesForPrice,
    enabled: allCurrenciesForPrice.length > 0,
  })

  const destinationPrice = useMemo(() => {
    if (!destinationCurrency || !pricesData) return undefined
    const chainId = destinationCurrency.chainId || destinationChainId
    const priceKey = destinationCurrency.address.toLowerCase()
    return pricesData[chainId]?.[priceKey]?.usd
  }, [destinationCurrency, pricesData, destinationChainId])

  const inputActionTokenPrice = useMemo(() => {
    if (!inputActionCurrency || !pricesData) return undefined
    const chainId = inputActionCurrency.chainId || inputActionChainId
    const priceKey = inputActionCurrency.address.toLowerCase()
    return pricesData[chainId!]?.[priceKey]?.usd
  }, [inputActionCurrency, pricesData, inputActionChainId])

  const { slippage } = useSlippage()
  const quoteTrace = useQuoteTrace()

  const setInputInfo = useCallback<ActionHandler>(
    (
      currencyAmount: RawCurrencyAmount | undefined,
      receiverAddress: string | undefined,
      inputCalls: ActionCall[],
      actionLabel?: string,
      actionId?: string
    ) => {
      if (!currencyAmount) {
        setInputInfoState(undefined)
        setInputCalls([])
        const prevInputActionCurrency = inputActionCurrency
        setInputActionCurrency(undefined)
        if (prevInputActionCurrency) {
          setActionResetKey((prev) => prev + 1)
        }
        return
      }

      const inputCur = currencyAmount.currency as RawCurrency
      setInputActionCurrency(inputCur)

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        setInputInfoState(undefined)
        setInputCalls([])
        setInputActionCurrency(undefined)
        return
      }

      setInputInfoState({ currencyAmount, actionLabel, actionId })
      setInputCalls(inputCalls)

      quoteTrace.addTrace({
        quotes: [],
        actionInfo: {
          actionType: actionId || 'action',
          actionLabel: actionLabel || 'Input intent',
          actionId,
          destinationCalls: inputCalls,
        },
        requestInfo: {
          srcCurrency: currencyAmount.currency,
          dstCurrency: destinationCurrency,
          amount: currencyAmount.amount.toString(),
          slippage,
        },
        success: true,
      })
    },
    [destinationCurrency, slippage, quoteTrace, inputActionCurrency]
  )

  return (
    <div>
      <ReverseActionsPanel
        resetKey={actionResetKey}
        srcCurrency={inputActionCurrency}
        dstCurrency={destinationCurrency}
        currentChainId={currentChainId}
        setActionInfo={setInputInfo}
        quotes={[]}
        selectedQuoteIndex={0}
        setSelectedQuoteIndex={() => {}}
        slippage={slippage}
        onDstCurrencyChange={setDestinationCurrency}
        calculatedInputAmount={undefined}
        actionInfo={inputInfo}
        pricesData={pricesData}
        isLoadingPrices={isLoadingPrices}
        isFetchingPrices={isFetchingPrices}
      />

      {inputInfo && inputActionCurrency && destinationCurrency && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-info/10 border border-info p-3">
            <div className="flex items-start gap-2">
              <span className="text-info text-lg">ℹ️</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-info">Quote Not Available</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
