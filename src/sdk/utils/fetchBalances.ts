import { Address, encodePacked, formatUnits, zeroAddress } from 'viem'
import { BalanceFetcherAbi } from '../../lib/abi'
import { getRpcSelectorEvmClient, RpcAction } from '@1delta/lib-utils'
import { chains as dataChains } from '@1delta/data-sdk'
import { loadTokenLists, getTokenFromCache } from '../../lib/data/tokenListsCache'
import type { RawCurrency } from '../../types/currency'

export function getAssetFromListsSync(
  chainId: string,
  assetAddress: string
): { isReady: boolean; data?: RawCurrency } {
  if (assetAddress.toLowerCase() === zeroAddress.toLowerCase()) {
    const info = dataChains()?.[chainId]?.nativeCurrency
    if (!info) return { isReady: false }
    return {
      isReady: true,
      data: {
        chainId: chainId,
        address: zeroAddress,
        symbol: info.symbol,
        name: info.name,
        decimals: info.decimals,
      },
    }
  }

  const token = getTokenFromCache(chainId, assetAddress)
  return { isReady: !!token, data: token }
}

const BALANCE_FETCHER: Address = '0x60134ad7491101c7fcb343ed8c7599e449430766'

interface BalanceFetchReturnOnChain {
  timestamp: string | number
  blockNumber: string | number
  nativeBalance: {
    balanceRaw: string
    balance: string
    balanceUsd: number
  }
  tokenData: {
    [assetAddress: string]: {
      balanceRaw: string
      balance: string
      balanceUsd: number
    }
  }
  account?: string | undefined
  isArgentWallet?: undefined | boolean
  chainId: string
  tokensToAdd?: {
    [s: string]: {
      name: string
      symbol: string
      decimals: number
      address: string
    }
  }
}

export async function fetchEvmUserTokenDataEnhanced(
  chainId: string,
  account: string | Address,
  assets: string[] | Address[] = []
): Promise<BalanceFetchReturnOnChain | null> {
  await loadTokenLists()
  const assetsToQuery =
    assets.length > 0 && !assets.includes(zeroAddress) ? [zeroAddress, ...assets] : assets

  let balanceFetcherResult: any
  let blockTimestamp: string | undefined

  try {
    const provider = await getRpcSelectorEvmClient(chainId, RpcAction.BALANCE)
    if (!provider) {
      console.warn('Could not get RPC client for balance fetching')
      return null
    }

    const result = await provider.simulateContract({
      address: BALANCE_FETCHER,
      abi: BalanceFetcherAbi,
      functionName: '1delta',
      args: [balanceFetcherEncoder([account], assetsToQuery) as `0x${string}`],
    })

    balanceFetcherResult = result?.result ?? '0x'

    const block = await provider.getBlock()
    blockTimestamp = block?.timestamp.toString()

    console.debug(`${chainId} balances are fetched.`)
  } catch (e) {
    console.warn('failed balance fetching', chainId, e)
    return null // return null to prevent resetting balances
  }

  // Parse the balance data
  const parsedData = parseBalanceData(balanceFetcherResult, [account], assetsToQuery)

  const { balances, blockNumber } = parsedData

  if (balances.length === 0) {
    console.debug(`fetchBalances:: ${chainId} no balances found.`)
    return null
  }

  const tokenData: {
    [assetAddress: string]: {
      balanceRaw: string
      balance: string
      balanceUsd: number
    }
  } = {}

  const nativeBalance = balances[0].balances?.[zeroAddress]

  const nativeDecimals = dataChains()?.[chainId]?.nativeCurrency?.decimals || 18
  const nativeData = nativeBalance
    ? {
        balanceRaw: nativeBalance.balance.toString(),
        balance: formatUnits(nativeBalance.balance, nativeDecimals),
        balanceUsd: 0,
      }
    : {
        balanceRaw: '0',
        balance: '0',
        balanceUsd: 0,
      }

  assets
    .filter((address) => address !== zeroAddress)
    .forEach((address) => {
      const data = balances[0]?.balances[address]
      if (data) {
        const asset = assetsToQuery[data.tokenIndex]
        const assetResult = getAssetFromListsSync(chainId, asset)
        if (assetResult.isReady && assetResult.data?.decimals !== undefined) {
          const numberBalance = formatUnits(data.balance, assetResult.data.decimals)
          tokenData[asset] = {
            balanceRaw: data.balance.toString(),
            balance: numberBalance,
            balanceUsd: 0,
          }
        } else {
          tokenData[asset] = {
            balanceRaw: data.balance.toString(),
            balance: '0',
            balanceUsd: 0,
          }
        }
      } else {
        tokenData[address] = {
          balanceRaw: '0',
          balance: '0',
          balanceUsd: 0,
        }
      }
    })

  return {
    timestamp: blockTimestamp ?? Math.floor(Date.now() / 1000),
    blockNumber: blockNumber.toString(),
    nativeBalance: nativeData,
    tokenData,
    account: account as string,
    chainId,
  }
}

function balanceFetcherEncoder(accounts: string[] | Address[], tokens: string[] | Address[]) {
  if (accounts.length < 1 || tokens.length < 1) {
    // no balance can be fetched, return empty calldata
    return '0x'
  }
  return (
    encodePacked(
      ['uint16', 'uint16'], // number of tokens, number of addresses
      [tokens.length, accounts.length]
    ) +
    encodePacked(
      accounts.map(() => 'address'),
      accounts
    ).slice(2) +
    encodePacked(
      tokens.map(() => 'address'),
      tokens
    ).slice(2)
  )
}

export function parseBalanceData(hexData: string, users: string[], tokens: string[]) {
  const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData
  let offset = 0

  const blockNumberHex = data.slice(offset, offset + 16)
  const blockNumber = BigInt('0x' + blockNumberHex)
  offset += 16

  const results: Array<{
    userIndex: number
    userAddress: string
    balances: Record<
      string,
      {
        tokenIndex: number
        tokenAddress: string
        balance: bigint
      }
    >
  }> = []
  const assetsNonzero: string[] = []
  while (offset < data.length) {
    const userIndexHex = data.slice(offset, offset + 4)
    const userIndex = parseInt(userIndexHex, 16)

    offset += 4
    const countHex = data.slice(offset, offset + 4)
    const count = parseInt(countHex, 16)

    offset += 4

    const balances: Record<
      string,
      {
        tokenIndex: number
        tokenAddress: string
        balance: bigint
      }
    > = {}

    for (let i = 0; i < count; i++) {
      const tokenIndexHex = data.slice(offset, offset + 4)
      const tokenIndex = parseInt(tokenIndexHex, 16)

      offset += 4

      const balanceHex = data.slice(offset, offset + 28)
      const balance = BigInt('0x' + balanceHex)

      offset += 28

      assetsNonzero.push(tokens[tokenIndex])
      balances[tokens[tokenIndex]] = {
        tokenIndex,
        tokenAddress: tokens[tokenIndex],
        balance,
      }
    }

    results.push({
      userIndex,
      userAddress: users[userIndex],
      balances,
    })
  }

  return {
    balances: results,
    blockNumber,
  }
}
