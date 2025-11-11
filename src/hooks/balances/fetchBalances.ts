import { Address, encodePacked, formatUnits, zeroAddress } from "viem"
import { BalanceFetcherAbi, MulticallABI } from "../../lib/abi"
import { multicallViem } from "@1delta/lib-utils/dist/services/multicall/evm"
import { getRpcSelectorEvmClient } from "@1delta/lib-utils"
import { chains as dataChains } from "@1delta/data-sdk"
import { loadTokenLists, getTokenFromCache } from "../../lib/data/tokenListsCache"
import type { RawCurrency } from "@1delta/lib-utils"

export function getAssetFromListsSync(chainId: string, assetAddress: string): { isReady: boolean; data?: RawCurrency } {
    // Handle zero address (native token) - return wrapped native info
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

async function multicallRetry(chainId: string, calls: Call[], abis: any[], _retries?: number): Promise<any[]> {
    const results = await multicallViem(chainId, abis, calls, 0, true, undefined, true)
    return results
}

const BALANCE_FETCHER: Address = "0x60134ad7491101c7fcb343ed8c7599e449430766"
export interface BalanceInfo {
    balanceRaw: string
    balance: string
    balanceUsd: number
}
export interface TokenMeta {
    name: string
    symbol: string
    decimals: number
    address: string
}
export type TokenMetaMap = { [s: string]: TokenMeta }
export type TokenData = { [assetAddress: string]: BalanceInfo }
export interface BalanceFetchReturnOnChain {
    timestamp: string | number
    blockNumber: string | number
    nativeBalance: BalanceInfo
    tokenData: TokenData
    account?: string | undefined
    isArgentWallet?: undefined | boolean
    chainId: string
    tokensToAdd?: TokenMetaMap
}

export declare interface GeneralCall {
    address: string // Address of the contract
    name: string // Function name on the contract (example: balanceOf)
    params?: any[] // Function params
}

export type Call = GeneralCall

export async function fetchEvmUserTokenDataEnhanced(
    chainId: string,
    account: string | Address,
    assets: string[] | Address[] = []
): Promise<BalanceFetchReturnOnChain | null> {
    // Ensure token lists are loaded
    await loadTokenLists()

    // zero address is used to fetch native balance
    const assetsToQuery = [zeroAddress, ...assets]

    const balanceFetcherCall: Call = {
        address: BALANCE_FETCHER,
        name: "1delta", // the selector is actually ignored for this function
        params: [balanceFetcherEncoder([account], assetsToQuery)],
    }

    let argentCall: Call | undefined = undefined
    let argentCallResult: any | undefined = undefined

    let balanceFetcherResult: any
    if (argentCall) {
        // Then we should use multicall
        try {
            const st = performance.now()

            const multicallResult = await multicallRetry(
                chainId,
                [balanceFetcherCall, argentCall],
                [...MulticallABI, ...BalanceFetcherAbi],
                undefined
            )
            console.debug("multicall-enhanced: took", performance.now() - st, "for", multicallResult.length, "on", chainId)

            balanceFetcherResult = multicallResult[0]
            argentCallResult = multicallResult[1]
            if (!balanceFetcherResult || balanceFetcherResult === "0x") {
                console.warn("No balance fetcher result returned")
                // this should never happen (worst case scenario, it returns some data, e.g. nativebalance), but we'll handle it just in case
                return null
            }
        } catch (e) {
            console.warn("failed multicall for balance fetcher and argent detector multicall", chainId, e)
            return null // return null to prevent resetting balances
        }
    } else {
        const st = performance.now()

        try {
            const provider = await getRpcSelectorEvmClient(chainId)
            if (!provider) {
                console.warn("Could not get RPC client for balance fetching")
                return null
            }
            const result = await provider.simulateContract({
                address: BALANCE_FETCHER,
                abi: BalanceFetcherAbi,
                functionName: "1delta",
                args: [balanceFetcherEncoder([account], assetsToQuery) as `0x${string}`],
            })

            balanceFetcherResult = result?.result ?? "0x"

            console.debug("balance fetcher: took", performance.now() - st, "on", chainId)
        } catch (e) {
            console.warn("failed balance fetching", chainId, e)
            return null // return null to prevent resetting balances
        }
    }

    let blockTimestamp: string | undefined
    try {
        const provider = await getRpcSelectorEvmClient(chainId)
        if (!provider) {
            throw new Error("Could not get RPC client")
        }
        const block = await provider.getBlock()
        blockTimestamp = block?.timestamp.toString()
    } catch (e) {
        console.error("Failed to get block timestamp", e)
        blockTimestamp = String(Math.round(Date.now() / 1000))
    }

    // Parse the balance data
    const parsedData = parseBalanceData(balanceFetcherResult, [account], assetsToQuery)

    const { balances, blockNumber } = parsedData

    if (balances.length === 0) {
        console.log("No balances found in parsed data")
        return null
    }

    const tokenData: { [assetAddress: string]: BalanceInfo } = {}

    const nativeBalance = balances[0].balances?.[zeroAddress]

    const nativeDecimals = dataChains()?.[chainId]?.nativeCurrency?.decimals || 18
    const nativeData: BalanceInfo = nativeBalance
        ? {
              balanceRaw: nativeBalance.balance.toString(),
              balance: formatUnits(nativeBalance.balance, nativeDecimals),
              balanceUsd: 0,
          }
        : {
              balanceRaw: "0",
              balance: "0",
              balanceUsd: 0,
          }

    assets.forEach((address) => {
        if (address !== zeroAddress) {
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
                        balance: "0",
                        balanceUsd: 0,
                    }
                }
            } else {
                tokenData[address] = {
                    balanceRaw: "0",
                    balance: "0",
                    balanceUsd: 0,
                }
            }
        }
    })

    return {
        timestamp: blockTimestamp ?? Math.floor(Date.now() / 1000), // :) should be handled better!
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
        return "0x"
    }
    return (
        encodePacked(
            ["uint16", "uint16"], // number of tokens, number of addresses
            [tokens.length, accounts.length]
        ) +
        encodePacked(
            accounts.map(() => "address"),
            accounts
        ).slice(2) +
        encodePacked(
            tokens.map(() => "address"),
            tokens
        ).slice(2)
    )
}

export function parseBalanceData(hexData: string, users: string[], tokens: string[]) {
    const data = hexData.startsWith("0x") ? hexData.slice(2) : hexData
    let offset = 0

    const blockNumberHex = data.slice(offset, offset + 16)
    const blockNumber = BigInt("0x" + blockNumberHex)
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
            const balance = BigInt("0x" + balanceHex)

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
