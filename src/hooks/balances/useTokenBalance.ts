import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import { fetchEvmUserTokenDataEnhanced } from '../../sdk/utils/fetchBalances'
import type { RawCurrencyAmount } from '../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { getCurrency } from '../../lib/trade-helpers/utils'

async function fetchTokenBalance(
  chainId: string,
  userAddress: Address,
  tokenAddress: Address
): Promise<RawCurrencyAmount | undefined> {
  try {
    const currency = getCurrency(chainId, tokenAddress)
    if (!currency) return undefined

    const assetsToFetch =
      tokenAddress.toLowerCase() === zeroAddress.toLowerCase() ? [] : [tokenAddress]
    const balanceData = await fetchEvmUserTokenDataEnhanced(chainId, userAddress, assetsToFetch)
    if (!balanceData) return undefined

    let rawAmount: bigint

    if (tokenAddress.toLowerCase() === zeroAddress.toLowerCase()) {
      rawAmount = BigInt(balanceData.nativeBalance.balanceRaw)
    } else {
      const tokenInfo = balanceData.tokenData[tokenAddress.toLowerCase()]
      if (!tokenInfo) return undefined
      rawAmount = BigInt(tokenInfo.balanceRaw)
    }

    return CurrencyHandler.fromRawAmount(currency, rawAmount)
  } catch (e) {
    console.warn(`Failed to fetch balance for token ${tokenAddress} on chain ${chainId}:`, e)
    return undefined
  }
}

export function useTokenBalance(params: {
  chainId: string
  userAddress?: Address
  tokenAddress?: Address
}) {
  const { chainId, userAddress, tokenAddress } = params
  return useQuery({
    queryKey: ['tokenBalance', chainId, userAddress ?? '0x', tokenAddress?.toLowerCase() ?? '0x'],
    enabled: Boolean(chainId && userAddress && tokenAddress),
    queryFn: () => fetchTokenBalance(chainId, userAddress as Address, tokenAddress as Address),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: false,
  })
}
