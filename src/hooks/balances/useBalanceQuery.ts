import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import { useAccount } from 'wagmi'
import { fetchEvmUserTokenDataEnhanced } from '../../sdk/utils/fetchBalances'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { getCurrency } from '../../lib/trade-helpers/utils'

export type BalanceData = {
  raw: string
  value: string
  amount?: RawCurrencyAmount
}

export type BalancesRecord = Record<string, Record<string, BalanceData>>

async function fetchBalances(
  currencies: RawCurrency[],
  userAddress: Address
): Promise<BalancesRecord> {
  if (currencies.length === 0) return {}

  const currenciesByChain: Record<string, Record<string, RawCurrency>> = {}

  for (const currency of currencies) {
    if (!currency?.chainId || !currency?.address) continue

    const chainId = currency.chainId
    const address = currency.address.toLowerCase()

    if (!currenciesByChain[chainId]) {
      currenciesByChain[chainId] = {}
    }

    currenciesByChain[chainId][address] = currency
  }

  const chainPromises = Object.entries(currenciesByChain).map(async ([chainId, items]) => {
    const result: Record<string, BalanceData> = {}

    const uniqueAddresses = Array.from(new Set(Object.keys(items))) as Address[]

    if (uniqueAddresses.length === 0) return { chainId, balances: result }

    const tokenAddresses = uniqueAddresses.filter((addr) => addr !== zeroAddress)

    try {
      const balanceData = await fetchEvmUserTokenDataEnhanced(chainId, userAddress, tokenAddresses)
      if (!balanceData) return { chainId, balances: result }

      for (const address of Object.keys(items)) {
        let rawAmount: string
        let value: string

        if (address === zeroAddress.toLowerCase()) {
          rawAmount = balanceData.nativeBalance.balanceRaw
          value = balanceData.nativeBalance.balance
        } else {
          const tokenInfo = balanceData.tokenData[address]
          if (tokenInfo) {
            rawAmount = tokenInfo.balanceRaw
            value = tokenInfo.balance
          } else {
            rawAmount = '0'
            value = '0'
          }
        }

        const balanceDataEntry: BalanceData = {
          raw: rawAmount,
          value: value,
        }

        try {
          const currencyObj = getCurrency(chainId, address as Address)
          if (currencyObj) {
            const amount = CurrencyHandler.fromRawAmount(currencyObj, BigInt(rawAmount))
            balanceDataEntry.amount = amount
          }
        } catch (e) {
          console.warn(`Failed to create RawCurrencyAmount for ${address} on chain ${chainId}:`, e)
        }

        result[address] = balanceDataEntry
      }
    } catch (e) {
      console.warn(`Failed to fetch balances for chain ${chainId}:`, e)
    }

    return { chainId, balances: result }
  })

  const results = await Promise.all(chainPromises)

  const output: BalancesRecord = {}

  for (const { chainId, balances } of results) {
    output[chainId] = balances
  }

  return output
}

export function useBalanceQuery(params: { currencies: RawCurrency[]; enabled?: boolean }) {
  const { currencies, enabled = true } = params
  const { address: userAddress } = useAccount()

  const queryKey = useMemo(() => {
    const keys: Set<string> = new Set()
    for (const currency of currencies) {
      if (currency?.chainId && currency?.address) {
        keys.add(`${currency.chainId}:${currency.address.toLowerCase()}`)
      }
    }
    return ['balances', userAddress ?? '0x', ...Array.from(keys).sort()]
  }, [currencies, userAddress])

  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(currencies && currencies.length > 0 && userAddress),
    queryFn: () => fetchBalances(currencies, userAddress as Address),
    refetchOnWindowFocus: false,
  })

  return query
}
