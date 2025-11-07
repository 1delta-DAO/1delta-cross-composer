import { useMemo, useState, useEffect } from "react"
import { loadTokenLists, getTokenListsCache } from "../lib/data/tokenListsCache"

export type TokenListsRecord = Record<string, Record<string, any>>

let cachedLists: TokenListsRecord | null = null
let loadingPromise: Promise<TokenListsRecord> | null = null

export function useTokenLists() {
    const [data, setData] = useState<TokenListsRecord | null>(cachedLists || getTokenListsCache())
    const [isLoading, setIsLoading] = useState(!cachedLists && !getTokenListsCache())

    useEffect(() => {
        const cached = getTokenListsCache()
        if (cached) {
            cachedLists = cached
            setData(cached)
            setIsLoading(false)
            return
        }

        if (!loadingPromise) {
            loadingPromise = loadTokenLists().then((result) => {
                cachedLists = result
                return result
            })
        }

        loadingPromise
            .then((result) => {
                setData(result)
                setIsLoading(false)
            })
            .catch((e) => {
                console.error("Failed to load token lists:", e)
                setIsLoading(false)
            })
    }, [])

    return useMemo(
        () => ({
            data: data || ({} as TokenListsRecord),
            isLoading,
            error: null,
        }),
        [data, isLoading]
    )
}

