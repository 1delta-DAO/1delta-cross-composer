import { Chain } from "viem"

export const RATE_LIMIT_BLACKLIST_DURATION = 70_000 // 429 errors :: 70 seconds, most providers rate limit for a minute
export const AUTH_ERROR_BLACKLIST_DURATION = 1800_000 // 403 errors :: 30 mins
export const TIMEOUT_BLACKLIST_DURATION = 120_000 // timeouts :: 2 mins
export const OTHER_ERROR_BLACKLIST_DURATION = 300_000 // other errors :: 5 mins

export const DEFAULT_CONFIG = {
    maxConcurrentTests: 10,
    testTimeoutMs: 7000,
    minRequiredRpcs: 1,
    maxSelectedRpcs: 3,
    retestIntervalMs: 180_000, // 3 mins
}

export type CacheLocation = "memory" | "storage"

export interface CacheConfig {
    location: CacheLocation
    performanceCacheKey: string
}

/**
 * Cache configuration
 * @param location set to 'memory' or 'storage' to use in-memory or local storage cache
 */
export const CACHE_CONFIG: CacheConfig = {
    location: "memory",
    performanceCacheKey: "rpc_performance_cache",
}

export interface RpcPerformance {
    url: string
    latency: number
    success: boolean
    lastTested: number
    errorType?: "rate_limit" | "auth_error" | "timeout" | "other"
    blacklistedUntil?: number
}

export interface RpcTestResult {
    url: string
    latency: number
    success: boolean
    errorType?: "rate_limit" | "auth_error" | "timeout" | "other"
}

export interface ChainRpcConfig {
    rpcs: string[]
    chain: Chain
    maxConcurrentTests: number
    testTimeoutMs: number
    minRequiredRpcs: number
    maxSelectedRpcs: number
    retestIntervalMs: number
}
