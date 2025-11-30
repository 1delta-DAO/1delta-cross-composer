import { checksumAddress, type Address } from 'viem'
import { erc20Abi } from 'viem'
import { getTokenFromCache } from '../../lib/data/tokenListsCache'
import { getRpcSelectorEvmClient } from '@1delta/lib-utils'

export async function checkIsContract(address: Address, chainId: string): Promise<boolean> {
  try {
    const publicClient = await getRpcSelectorEvmClient(chainId)
    if (!publicClient) {
      return false
    }
    const code = await publicClient.getCode({ address })
    return code !== '0x'
  } catch {
    return false
  }
}

export async function fetchDecimals(
  tokenAddress: Address,
  chainId: string,
  decimalsCache: Record<Address, number>,
  loadingDecimals: Set<Address>,
  setDecimalsCache: (updater: (prev: Record<Address, number>) => Record<Address, number>) => void,
  setLoadingDecimals: (updater: (prev: Set<Address>) => Set<Address>) => void
): Promise<number | null> {
  // Check cache first
  if (decimalsCache[tokenAddress]) {
    return decimalsCache[tokenAddress]
  }

  // Check if already loading
  if (loadingDecimals.has(tokenAddress)) {
    return null
  }

  try {
    setLoadingDecimals((prev) => new Set(prev).add(tokenAddress))

    // First, check the asset list for this token
    // Try both checksummed and lowercase addresses as the list might use either format
    const checksummedAddr = checksumAddress(tokenAddress)
    const lowercaseAddr = tokenAddress.toLowerCase()
    const tokenFromList =
      getTokenFromCache(chainId, checksummedAddr) || getTokenFromCache(chainId, lowercaseAddr)
    if (tokenFromList && tokenFromList.decimals !== undefined) {
      const decimalsNumber = tokenFromList.decimals
      setDecimalsCache((prev) => ({
        ...prev,
        [tokenAddress]: decimalsNumber,
      }))
      return decimalsNumber
    }

    // If not in asset list, make on-chain call
    const isContract = await checkIsContract(tokenAddress, chainId)
    if (!isContract) {
      console.warn(`Address ${tokenAddress} is not a contract`)
      return null
    }

    const publicClient = await getRpcSelectorEvmClient(chainId)
    if (!publicClient) {
      console.warn(`Could not get RPC client for chain ${chainId}`)
      return null
    }
    const decimals = await publicClient.readContract({
      address: checksumAddress(tokenAddress),
      abi: erc20Abi,
      functionName: 'decimals',
    })

    const decimalsNumber = Number(decimals)
    setDecimalsCache((prev) => ({
      ...prev,
      [tokenAddress]: decimalsNumber,
    }))

    return decimalsNumber
  } catch (err) {
    console.error(`Failed to fetch decimals for token ${tokenAddress}:`, err)
    return null
  } finally {
    setLoadingDecimals((prev) => {
      const newSet = new Set(prev)
      newSet.delete(tokenAddress)
      return newSet
    })
  }
}
