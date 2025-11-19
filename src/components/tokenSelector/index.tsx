import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { useTokenLists } from "../../hooks/useTokenLists"
import { useEvmBalances } from "../../hooks/balances/useEvmBalances"
import { useDexscreenerPrices } from "../../hooks/prices/useDexscreenerPrices"
import { useChainsRegistry } from "../../sdk/hooks/useChainsRegistry"
import { CurrencyHandler, SupportedChainId } from "../../sdk/types"
import { getTokenFromCache } from "../../lib/data/tokenListsCache"
import { TokenSelectorDropdownMode } from "./Dropdown"
import { TokenSelectorListMode } from "./ListMode"

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

type TokenRowData = {
  addr: Address
  token: any
  usdValue: number
  price: number
  balanceAmount: number
  category: number
  isRelevant: boolean
}

// Stablecoin symbols (common stablecoins)
const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI", "BUSD", "FRAX", "USDD", "USDE", "TUSD", "LUSD", "SUSD", "GUSD", "MIM", "DOLA"])

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

  const relevant = useMemo(() => {
    const relevantTokens: Address[] = []

    const isAlreadyIncluded = (addr: string) => {
      const addrLower = addr.toLowerCase()
      return relevantTokens.some((a) => a.toLowerCase() === addrLower)
    }

    const addTokenIfNotIncluded = (candidates: [string, any][], selector: (candidates: [string, any][]) => [string, any] | undefined) => {
      if (candidates.length === 0) return
      const selected = selector(candidates)
      if (selected && !isAlreadyIncluded(selected[0])) {
        relevantTokens.push(selected[0] as Address)
      }
    }

    // Native
    relevantTokens.push(zeroAddress as Address)

    const wrappedNative = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
    if (wrappedNative) {
      const wrappedAddr = wrappedNative.toLowerCase()
      const wrappedLower = Object.keys(tokensMap).find((addr) => addr.toLowerCase() === wrappedAddr)
      if (wrappedLower && !isAlreadyIncluded(wrappedLower)) {
        relevantTokens.push(wrappedLower as Address)
      } else {
        const nativeSymbol = nativeCurrencySymbol
        const wrappedEntry = Object.entries(tokensMap).find(([addr, t]: [string, any]) => {
          const addrLower = addr.toLowerCase()
          const isWrapped = addrLower === wrappedAddr
          const hasWnativeProp = t?.props?.wnative === true
          const assetGroupMatches = t?.assetGroup?.toUpperCase() === nativeSymbol
          return (isWrapped || hasWnativeProp || assetGroupMatches) && !isAlreadyIncluded(addr)
        })
        if (wrappedEntry) {
          relevantTokens.push(wrappedEntry[0] as Address)
        }
      }
    }

    // USDC selection logic
    const usdcCandidates = Object.entries(tokensMap).filter(([, t]: [string, any]) => t?.assetGroup === "USDC")
    addTokenIfNotIncluded(usdcCandidates, (candidates) => {
      const isMoonbeam = chainId === SupportedChainId.MOONBEAM
      if (isMoonbeam) {
        // On moonbeam, prefer xc tokens
        const xcUsdc = candidates.find(([, t]: [string, any]) => {
          const symbolUpper = t?.symbol?.toUpperCase() || ""
          return symbolUpper.startsWith("XC") && symbolUpper.includes("USDC")
        })
        if (xcUsdc) return xcUsdc
      }
      return candidates.find(([, t]: [string, any]) => t?.symbol?.toUpperCase() === "USDC") || candidates[0]
    })

    // USDT selection logic
    const usdtCandidates = Object.entries(tokensMap).filter(([, t]: [string, any]) => t?.assetGroup === "USDT")
    addTokenIfNotIncluded(usdtCandidates, (candidates) => {
      const isMoonbeam = chainId === SupportedChainId.MOONBEAM
      if (isMoonbeam) {
        // On moonbeam, prefer xc tokens
        const xcUsdt = candidates.find(([, t]: [string, any]) => {
          const symbolUpper = t?.symbol?.toUpperCase() || ""
          return symbolUpper.startsWith("XC") && symbolUpper.includes("USDT")
        })
        if (xcUsdt) return xcUsdt
      }
      return candidates.find(([, t]: [string, any]) => t?.symbol?.toUpperCase() === "USDT") || candidates[0]
    })

    // WBTC selection logic
    const wbtcCandidates = Object.entries(tokensMap).filter(([, t]: [string, any]) => {
      const symbolUpper = t?.symbol?.toUpperCase() || ""
      const assetGroupUpper = t?.assetGroup?.toUpperCase() || ""
      return (
        symbolUpper.includes("WBTC") || assetGroupUpper.includes("WBTC") || (assetGroupUpper.includes("BTC") && !assetGroupUpper.includes("INTER"))
      )
    })
    addTokenIfNotIncluded(wbtcCandidates, (candidates) => {
      return candidates.find(([, t]: [string, any]) => t?.symbol?.toUpperCase() === "WBTC") || candidates[0]
    })

    return relevantTokens
  }, [tokensMap, chainId, nativeCurrencySymbol])

  const getStablecoinFallbackPrice = useCallback((chainId: string, address: string): number | undefined => {
    const token = getTokenFromCache(chainId, address)
    if (!token) return undefined
    const symbol = (token as any)?.symbol?.toUpperCase?.() || ""
    const assetGroup = (token as any)?.assetGroup || ""
    if (assetGroup === "USDC") return 1
    if (symbol === "USDC" || symbol === "USDT" || symbol === "DAI" || symbol === "USDBC" || symbol === "XCUSDC" || symbol === "XCUSDT") return 1
    return undefined
  }, [])

  const priceAddresses = useMemo(() => {
    const addressesWithBalance: Address[] = []
    const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)

    if (balances?.[chainId] && userAddress) {
      for (const addr of addressesWithNative) {
        const bal = balances[chainId][addr.toLowerCase()]
        if (bal && Number(bal.value || 0) > 0) {
          if (addr.toLowerCase() === zeroAddress.toLowerCase() && wrapped) {
            if (!addressesWithBalance.includes(wrapped as Address)) {
              addressesWithBalance.push(wrapped as Address)
            }
          } else {
            if (!addressesWithBalance.includes(addr)) {
              addressesWithBalance.push(addr)
            }
          }
        }
      }
    }

    for (const addr of relevant) {
      const addrLower = addr.toLowerCase()
      if (addrLower === zeroAddress.toLowerCase() && wrapped) {
        if (!addressesWithBalance.includes(wrapped as Address)) {
          addressesWithBalance.push(wrapped as Address)
        }
      } else {
        if (!addressesWithBalance.includes(addr)) {
          addressesWithBalance.push(addr)
        }
      }
    }

    return addressesWithBalance
  }, [balances, chainId, addressesWithNative, userAddress, relevant])

  const { data: prices, isLoading: pricesLoading } = useDexscreenerPrices({
    chainId,
    addresses: priceAddresses,
    enabled: priceAddresses.length > 0,
  })

  const getTokenCategory = useCallback(
    (token: { symbol: string }): number => {
      const symbolUpper = token.symbol.toUpperCase()
      const isNative = symbolUpper === nativeCurrencySymbol
      const isWrappedNative = symbolUpper === `W${nativeCurrencySymbol}` || symbolUpper.startsWith(`W${nativeCurrencySymbol}`)

      if (isNative || isWrappedNative) {
        return 1
      }

      if (LST_SYMBOLS.has(symbolUpper) || symbolUpper.includes("ST") || (symbolUpper.includes("ETH") && symbolUpper.includes("S"))) {
        return 2
      }

      if (STABLECOIN_SYMBOLS.has(symbolUpper)) {
        return 3
      }

      if (BITCOIN_SYMBOLS.has(symbolUpper) || symbolUpper.includes("BTC")) {
        return 4
      }

      return 5
    },
    [nativeCurrencySymbol],
  )

  const rows: TokenRowData[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const relevantSet = new Set(relevant.map((addr) => addr.toLowerCase()))

    const filtered = allAddrs
      .map((addr) => {
        const token = tokensMap[addr]
        const bal = balances?.[chainId]?.[addr.toLowerCase()]
        const priceData = prices?.[chainId]?.[addr.toLowerCase()]
        const price = priceData?.usd

        // Get fallback price for stablecoins if no price from API
        const fallbackPrice = price || getStablecoinFallbackPrice(chainId, addr) || 0
        const finalPrice = price || fallbackPrice

        // Calculate USD value: balance * price, or use price for sorting if no balance
        const balanceAmount = bal ? Number(bal.value || 0) : 0
        const usdValue = balanceAmount * finalPrice

        const isRelevant = relevantSet.has(addr.toLowerCase())
        return { addr, token, usdValue, price: finalPrice, balanceAmount, category: getTokenCategory(token), isRelevant }
      })
      .filter(({ addr }) => !excludeAddresses || !excludeAddresses.map((a) => a.toLowerCase()).includes(addr.toLowerCase()))
      .filter(({ addr, token, isRelevant }) => {
        // Always include relevant tokens in the list, regardless of search query
        if (isRelevant) return true
        if (!q) return true
        const addrLower = addr.toLowerCase()
        const symbolLower = token.symbol.toLowerCase()
        const nameLower = token.name.toLowerCase()
        // Search by name, symbol, or address
        return symbolLower.includes(q) || nameLower.includes(q) || addrLower.includes(q)
      })

    // Sort by USD value (balance * price), then by price for tokens without balance
    return filtered.sort((a, b) => {
      // Primary: Sort by USD value (highest first)
      const usdValueDiff = b.usdValue - a.usdValue
      // If USD value difference is significant (> $0.01), prioritize USD value
      if (Math.abs(usdValueDiff) > 0.01) {
        return usdValueDiff
      }

      // Secondary: For tokens with same USD value (or both zero), sort by price
      // This helps sort tokens without balance by their price
      const priceDiff = b.price - a.price
      if (Math.abs(priceDiff) > 0.0001) {
        return priceDiff
      }

      // Tertiary: Sort by category (lower category number = higher priority)
      if (a.category !== b.category) {
        return a.category - b.category
      }

      // Quaternary: Alphabetically by symbol
      return a.token.symbol.localeCompare(b.token.symbol)
    })
  }, [allAddrs, tokensMap, searchQuery, balances, prices, chainId, excludeAddresses, getTokenCategory, relevant, getStablecoinFallbackPrice])

  const selected = value ? tokensMap[value.toLowerCase()] : undefined

  // List mode: just show the token list without dropdown button
  if (listMode) {
    return (
      <TokenSelectorListMode
        chainId={chainId}
        chains={chains}
        relevant={relevant}
        rows={rows}
        tokensMap={tokensMap}
        balances={balances}
        prices={prices}
        balancesLoading={balancesLoading}
        pricesLoading={pricesLoading}
        userAddress={userAddress}
        onChange={onChange}
      />
    )
  }

  // Dropdown mode: show button and dropdown
  return (
    <TokenSelectorDropdownMode
      dropdownRef={dropdownRef as any}
      open={open}
      setOpen={setOpen}
      chainId={chainId}
      chains={chains}
      relevant={relevant}
      rows={rows}
      tokensMap={tokensMap}
      balances={balances}
      prices={prices}
      balancesLoading={balancesLoading}
      pricesLoading={pricesLoading}
      userAddress={userAddress}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      showSearch={showSearch}
      listsLoading={listsLoading}
      selected={selected}
      onChange={onChange}
    />
  )
}
