import { MemoryCache } from "./MemoryCache"
import { StorageCache } from "./StorageCache"
import { CACHE_CONFIG, CacheConfig, RpcPerformance } from "../config"

export * from "./MemoryCache"
export * from "./StorageCache"

export interface CacheInterface<T> {
    get(key: string): T | undefined
    set(key: string, value: T): void
    delete(key: string): void
    clear(): void
    getAll(): Record<string, T>
    setAll(data: Record<string, T>): void
}

export function createCache<T>(config: CacheConfig, cacheKey: string): CacheInterface<T> {
    if (config.location === "memory") {
        return new MemoryCache<T>()
    } else {
        return new StorageCache<T>(cacheKey)
    }
}

export const rpcPerformanceCache = createCache<RpcPerformance[]>(CACHE_CONFIG, CACHE_CONFIG.performanceCacheKey)

export function cleanupExpiredCache() {
    if (CACHE_CONFIG.location === "memory") {
        // remove storage cache if any when cache location selected to be memory
        if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
            try {
                window.localStorage.removeItem(CACHE_CONFIG.performanceCacheKey)
            } catch {}
        }
        return
    }
    const now = Date.now()

    const allPerformanceData = rpcPerformanceCache.getAll()
    Object.keys(allPerformanceData).forEach((chainId) => {
        const stats = allPerformanceData[chainId]
        const validStats = stats.filter((stat) => {
            if (stat.blacklistedUntil && now < stat.blacklistedUntil) {
                return true // still blacklisted
            }
            return (
                stat.success || (stat.lastTested && now - stat.lastTested < 600 * 1000) // valid for 10 minutes
            )
        })

        if (validStats.length !== stats.length) {
            rpcPerformanceCache.set(chainId, validStats)
        }
    })
}
