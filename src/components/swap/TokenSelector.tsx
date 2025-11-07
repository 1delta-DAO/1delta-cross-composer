import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { useTokenLists } from "../../hooks/useTokenLists"
import { useEvmBalances } from "../../hooks/balances/useEvmBalances"
import { useDexscreenerPrices } from "../../hooks/prices/useDexscreenerPrices"
import { useChainsRegistry } from "../../hooks/useChainsRegistry"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"
import { Logo } from "../common/Logo"

type Props = {
    chainId: string
    userAddress?: Address
    value?: Address
    onChange: (address: Address) => void
    excludeAddresses?: Address[]
    query?: string
    onQueryChange?: (v: string) => void
    showSearch?: boolean
    listMode?: boolean // When true, shows only the list without dropdown button
}

const RELEVANT_SYMBOLS = ["ETH", "WETH", "USDC", "USDT", "GLMR", "WBTC"]

// Stablecoin symbols (common stablecoins)
const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI", "BUSD", "FRAX", "USDD", "TUSD", "LUSD", "SUSD", "GUSD", "MIM", "DOLA"])

// LST (Liquid Staking Token) patterns - common LST symbols
const LST_SYMBOLS = new Set(["STETH", "RETH", "CBETH", "SFRXETH", "WBETH", "STSOL", "MSOL", "JITOSOL"])

// Bitcoin tokens
const BITCOIN_SYMBOLS = new Set(["WBTC", "BTCB", "HBTC", "RENBTC", "TBTC"])

export function TokenSelector({
    chainId,
    userAddress,
    value,
    onChange,
    excludeAddresses,
    query: externalQuery,
    onQueryChange,
    showSearch = true,
    listMode = false,
}: Props) {
    const { data: lists, isLoading: listsLoading } = useTokenLists()
    const { data: chains } = useChainsRegistry()
    const [open, setOpen] = useState(false)
    const [internalQuery, setInternalQuery] = useState("")
    const searchQuery = externalQuery !== undefined ? externalQuery : internalQuery
    const setSearchQuery = onQueryChange || setInternalQuery
    const dropdownRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (listMode) return // No dropdown behavior in list mode
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false)
        }
        function onDocClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) {
            document.addEventListener("keydown", onKey)
            document.addEventListener("mousedown", onDocClick)
        }
        return () => {
            document.removeEventListener("keydown", onKey)
            document.removeEventListener("mousedown", onDocClick)
        }
    }, [open, listMode])

    const tokensMap = lists?.[chainId] || {}
    const allAddrs = useMemo(() => Object.keys(tokensMap) as Address[], [tokensMap])
    const nativeCurrencySymbol = chains?.[chainId]?.data?.nativeCurrency?.symbol?.toUpperCase() || ""

    // Include zero address for native token balance
    const addressesWithNative = useMemo(() => {
        const addrs = [...allAddrs.slice(0, 300)]
        if (!addrs.includes(zeroAddress as Address)) {
            addrs.unshift(zeroAddress as Address)
        }
        return addrs
    }, [allAddrs])

    const { data: balances, isLoading: balancesLoading } = useEvmBalances({
        chainId,
        userAddress,
        tokenAddresses: userAddress ? addressesWithNative : [],
    })

    // Include wrapped native address for native token price
    const priceAddresses = useMemo(() => {
        const addrs = [...allAddrs.slice(0, 300)]
        const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
        if (wrapped && !addrs.includes(wrapped as Address)) {
            addrs.push(wrapped as Address)
        }
        return addrs
    }, [allAddrs, chainId])

    const { data: prices, isLoading: pricesLoading } = useDexscreenerPrices({ chainId, addresses: priceAddresses })

    // Helper function to get token category for sorting
    const getTokenCategory = useCallback(
        (token: { symbol: string }): number => {
            const symbolUpper = token.symbol.toUpperCase()
            const isNative = symbolUpper === nativeCurrencySymbol
            const isWrappedNative = symbolUpper === `W${nativeCurrencySymbol}` || symbolUpper.startsWith(`W${nativeCurrencySymbol}`)

            // Category 1: Native or wrapped native (if not shown yet)
            if (isNative || isWrappedNative) {
                return 1
            }

            // Category 2: LST tokens
            if (LST_SYMBOLS.has(symbolUpper) || symbolUpper.includes("ST") || (symbolUpper.includes("ETH") && symbolUpper.includes("S"))) {
                return 2
            }

            // Category 3: Stablecoins
            if (STABLECOIN_SYMBOLS.has(symbolUpper)) {
                return 3
            }

            // Category 4: Bitcoin tokens
            if (BITCOIN_SYMBOLS.has(symbolUpper) || symbolUpper.includes("BTC")) {
                return 4
            }

            // Category 5: Everything else
            return 5
        },
        [nativeCurrencySymbol]
    )

    const rows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        const filtered = allAddrs
            .map((addr) => {
                const token = tokensMap[addr]
                const bal = balances?.[chainId]?.[addr.toLowerCase()]
                const price = prices?.[chainId]?.[addr.toLowerCase()]
                const usdValue = bal && price ? Number(bal.value || 0) * price.usd : 0
                return { addr, token, usdValue, category: getTokenCategory(token) }
            })
            .filter(({ addr }) => !excludeAddresses || !excludeAddresses.map((a) => a.toLowerCase()).includes(addr.toLowerCase()))
            .filter(({ addr, token }) => {
                if (!q) return true
                const addrLower = addr.toLowerCase()
                const symbolLower = token.symbol.toLowerCase()
                const nameLower = token.name.toLowerCase()
                // Search by name, symbol, or address
                return symbolLower.includes(q) || nameLower.includes(q) || addrLower.includes(q)
            })

        // Sort by:
        // 1. Highest USD balance first (primary sort)
        // 2. Then by category as tiebreaker:
        //    - Native/wrapped native and LST (category 1-2)
        //    - Stablecoins (category 3)
        //    - Bitcoin tokens (category 4)
        //    - Rest (category 5)
        // 3. Within same balance and category, sort alphabetically
        return filtered.sort((a, b) => {
            // Primary: Sort by USD balance (highest first)
            const balanceDiff = b.usdValue - a.usdValue
            // If balance difference is significant (> $0.01), prioritize balance
            if (Math.abs(balanceDiff) > 0.01) {
                return balanceDiff
            }

            // Secondary: Sort by category (lower category number = higher priority)
            if (a.category !== b.category) {
                return a.category - b.category
            }

            // Tertiary: Alphabetically by symbol
            return a.token.symbol.localeCompare(b.token.symbol)
        })
    }, [allAddrs, tokensMap, searchQuery, balances, prices, chainId, excludeAddresses, getTokenCategory])

    const relevant = useMemo(() => {
        const foundBySymbol: Address[] = []
        for (const sym of RELEVANT_SYMBOLS) {
            const entry = Object.entries(tokensMap).find(([, t]) => t.symbol.toUpperCase() === sym)
            if (entry) foundBySymbol.push(entry[0] as Address)
        }
        return foundBySymbol
    }, [tokensMap])

    const selected = value ? tokensMap[value.toLowerCase()] : undefined

    // List mode: just show the token list without dropdown button
    if (listMode) {
        return (
            <div className="w-full">
                <div className="flex flex-wrap gap-2 mb-2">
                    {relevant.map((addr) => {
                        const t = tokensMap[addr]
                        return (
                            <button
                                key={addr}
                                className="btn btn-sm btn-ghost gap-2"
                                onClick={() => {
                                    onChange(addr)
                                }}
                            >
                                <Logo src={t.logoURI} alt={t.symbol} fallbackText={t.symbol} />
                                <span>{t.symbol}</span>
                            </button>
                        )
                    })}
                </div>
                {relevant.length > 0 && <div className="divider my-1" />}
                <div className="overflow-auto">
                    {rows.map(({ addr, token }) => {
                        const bal = balances?.[chainId]?.[addr.toLowerCase()]
                        const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
                        const priceAddr = addr.toLowerCase() === zeroAddress.toLowerCase() ? wrapped : addr
                        const price = prices?.[chainId]?.[priceAddr?.toLowerCase() || ""]
                        const usd = bal && price ? Number(bal.value || 0) * price.usd : undefined
                        const showBalanceLoading = balancesLoading && userAddress && !bal
                        const showPriceLoading = pricesLoading && !price && !usd
                        const balanceText = bal?.value ? Number(bal.value).toFixed(4) : undefined
                        return (
                            <button
                                key={addr}
                                className="w-full py-2 px-2 hover:bg-base-200 rounded flex items-center gap-3"
                                onClick={() => {
                                    onChange(addr)
                                }}
                            >
                                <div className="relative w-6 h-6">
                                    <Logo src={token.logoURI} alt={token.symbol} fallbackText={token.symbol} />
                                    {chains?.[chainId]?.data?.icon && (
                                        <img
                                            src={chains[chainId].data.icon}
                                            alt="chain"
                                            className="w-3 h-3 rounded-full absolute -right-1 -bottom-1 border border-base-100"
                                        />
                                    )}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-medium">{token.name}</div>
                                    <div className="text-xs opacity-70">{token.symbol}</div>
                                </div>
                                <div className="text-right min-w-24">
                                    {showBalanceLoading ? (
                                        <span className="loading loading-spinner loading-xs" />
                                    ) : balanceText ? (
                                        <div className="font-mono text-sm opacity-80">{balanceText}</div>
                                    ) : null}
                                    {showPriceLoading ? (
                                        <span className="loading loading-spinner loading-xs ml-2" />
                                    ) : usd !== undefined && isFinite(usd) ? (
                                        <div className="text-xs opacity-60">${usd.toFixed(2)}</div>
                                    ) : null}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    // Dropdown mode: show button and dropdown
    return (
        <div className="relative" ref={dropdownRef}>
            <button type="button" className="btn btn-outline w-full flex items-center gap-2" onClick={() => setOpen((o) => !o)}>
                <Logo src={selected?.logoURI} alt={selected?.symbol || "Token"} fallbackText={selected?.symbol || "T"} />
                <span className="truncate">{selected?.symbol || (listsLoading ? "Loading tokens..." : "Select token")}</span>
                <span className="ml-auto tab">▼</span>
            </button>
            {open && (
                <div className="mt-2 p-2 rounded-box border border-base-300 bg-base-100 shadow-xl absolute z-20 w-full">
                    <div className="flex flex-wrap gap-2 mb-2">
                        {relevant.map((addr) => {
                            const t = tokensMap[addr]
                            return (
                                <button
                                    key={addr}
                                    className="btn btn-sm btn-ghost gap-2"
                                    onClick={() => {
                                        onChange(addr)
                                        setOpen(false)
                                    }}
                                >
                                    <Logo src={t.logoURI} alt={t.symbol} fallbackText={t.symbol} />
                                    <span>{t.symbol}</span>
                                </button>
                            )
                        })}
                    </div>
                    <div className="divider my-1" />
                    {showSearch && (
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tokens"
                            className="input input-bordered w-full mb-2"
                        />
                    )}
                    <div className="max-h-72 overflow-auto">
                        {rows.map(({ addr, token }) => {
                            const bal = balances?.[chainId]?.[addr.toLowerCase()]
                            const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
                            const priceAddr = addr.toLowerCase() === zeroAddress.toLowerCase() ? wrapped : addr
                            const price = prices?.[chainId]?.[priceAddr?.toLowerCase() || ""]
                            const usd = bal && price ? Number(bal.value || 0) * price.usd : undefined
                            const showBalanceLoading = balancesLoading && userAddress && !bal
                            const showPriceLoading = pricesLoading && !price && !usd
                            const balanceText = bal?.value ? Number(bal.value).toFixed(4) : undefined
                            return (
                                <button
                                    key={addr}
                                    className="w-full py-2 px-2 hover:bg-base-200 rounded flex items-center gap-3"
                                    onClick={() => {
                                        onChange(addr)
                                        setOpen(false)
                                    }}
                                >
                                    <div className="relative w-6 h-6">
                                        <Logo src={token.logoURI} alt={token.symbol} fallbackText={token.symbol} />
                                        {chains?.[chainId]?.data?.icon && (
                                            <img
                                                src={chains[chainId].data.icon}
                                                alt="chain"
                                                className="w-3 h-3 rounded-full absolute -right-1 -bottom-1 border border-base-100"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-medium">{token.name}</div>
                                        <div className="text-xs opacity-70">{token.symbol}</div>
                                    </div>
                                    <div className="text-right min-w-24">
                                        {showBalanceLoading ? (
                                            <span className="loading loading-spinner loading-xs" />
                                        ) : balanceText ? (
                                            <div className="font-mono text-sm opacity-80">{balanceText}</div>
                                        ) : null}
                                        {showPriceLoading ? (
                                            <span className="loading loading-spinner loading-xs ml-2" />
                                        ) : usd !== undefined && isFinite(usd) ? (
                                            <div className="text-xs opacity-60">${usd.toFixed(2)}</div>
                                        ) : null}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

function trimAmount(v: string): string {
    if (!v.includes(".")) return v
    const [w, f] = v.split(".")
    const frac = f.slice(0, 6).replace(/0+$/, "")
    return frac ? `${w}.${frac}` : w
}
