import {
  AUTH_ERROR_BLACKLIST_DURATION,
  OTHER_ERROR_BLACKLIST_DURATION,
  RATE_LIMIT_BLACKLIST_DURATION,
  RpcTestResult,
  TIMEOUT_BLACKLIST_DURATION,
} from './config'

export async function testRpc(
  rpcUrl: string,
  timeoutMs: number
): Promise<RpcTestResult> {
  const startTime = performance.now()

  try {
    if (rpcUrl.startsWith('wss://')) {
      return await testWebSocketRpc(rpcUrl, timeoutMs, startTime)
    }
    const response = await Promise.race([
      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ])

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('rate_limit')
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('auth_error')
      }

      const data = await response.json()
      if (data.error) {
        const errorMsg = (data.error.message || '').toLowerCase()
        const errorCode = data.error.code

        if (
          errorMsg.includes('rate limit') ||
          errorMsg.includes('too many requests') ||
          errorMsg.includes('exceeded') ||
          errorMsg.includes('limit exceeded') ||
          errorCode === 429
        ) {
          throw new Error('rate_limit')
        }

        if (errorMsg.includes('auth') || errorMsg.includes('unauthorized')) {
          throw new Error('auth_error')
        }

        throw new Error('other')
      }
    }

    const latency = performance.now() - startTime

    return {
      url: rpcUrl,
      latency,
      success: true,
    }
  } catch (error: any) {
    const errorType: 'rate_limit' | 'auth_error' | 'timeout' | 'other' = (
      error.message || 'other'
    ).toLowerCase()

    return {
      url: rpcUrl,
      latency: Infinity,
      success: false,
      errorType,
    }
  }
}

export async function batchTestRpcs(
  rpcs: string[],
  chainId: string,
  maxConcurrent: number,
  timeoutMs: number
): Promise<RpcTestResult[]> {
  const results: RpcTestResult[] = []

  for (let i = 0; i < rpcs.length; i += maxConcurrent) {
    const batch = rpcs.slice(i, i + maxConcurrent)

    const batchResults = await Promise.all(
      batch.map((rpc) => testRpc(rpc, timeoutMs))
    )

    results.push(...batchResults)
  }

  return results
}

export async function testWebSocketRpc(
  rpcUrl: string,
  timeoutMs: number,
  startTime: number
): Promise<RpcTestResult> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout | undefined
    let socket: WebSocket | undefined
    let resolved = false

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (socket) {
        socket.onerror = null
        socket.onclose = null
        socket.onmessage = null
        try {
          socket.close()
        } catch {}
      }
    }

    const resolveResult = (result: RpcTestResult) => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve(result)
      }
    }

    try {
      socket = new WebSocket(rpcUrl)

      timeoutId = setTimeout(() => {
        console.debug(`WebSocket timeout for ${rpcUrl} after ${timeoutMs}ms`)
        resolveResult({
          url: rpcUrl,
          latency: Infinity,
          success: false,
          errorType: 'timeout',
        })
      }, timeoutMs)

      socket.onopen = () => {
        const request = {
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }

        try {
          socket?.send(JSON.stringify(request))
        } catch (sendError) {
          console.debug(
            `Failed to send WebSocket message to ${rpcUrl}:`,
            sendError
          )
          resolveResult({
            url: rpcUrl,
            latency: Infinity,
            success: false,
            errorType: 'other',
          })
        }
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.error) {
            console.debug(`WebSocket RPC error from ${rpcUrl}:`, data.error)
            resolveResult({
              url: rpcUrl,
              latency: Infinity,
              success: false,
              errorType: extractWebSocketErrorType(data.error),
            })
          } else {
            const latency = performance.now() - startTime
            resolveResult({
              url: rpcUrl,
              latency,
              success: true,
            })
          }
        } catch (parseError) {
          console.debug(
            `Failed to parse WebSocket response from ${rpcUrl}:`,
            parseError
          )
          resolveResult({
            url: rpcUrl,
            latency: Infinity,
            success: false,
            errorType: 'other',
          })
        }
      }

      socket.onerror = (event) => {
        console.debug(`WebSocket error for ${rpcUrl}:`, event)
        resolveResult({
          url: rpcUrl,
          latency: Infinity,
          success: false,
          errorType: 'other',
        })
      }

      socket.onclose = (event) => {
        if (!resolved) {
          const wasClean = event.code === 1000 || event.code === 1001
          if (!wasClean) {
            // 1000 = Normal Closure, 1001 = Going Away
            console.debug(
              `WebSocket closed unexpectedly for ${rpcUrl}: code=${event.code}, reason=${event.reason || 'none'}`
            )
            resolveResult({
              url: rpcUrl,
              latency: Infinity,
              success: false,
              errorType: event.code === 1008 ? 'auth_error' : 'other', // 1008 = Policy Violation
            })
          }
        }
      }
    } catch (error) {
      console.debug(`WebSocket connection error for ${rpcUrl}:`, error)
      resolveResult({
        url: rpcUrl,
        latency: Infinity,
        success: false,
        errorType: 'other',
      })
    }
  })
}

function extractWebSocketErrorType(
  error: any
): 'rate_limit' | 'auth_error' | 'timeout' | 'other' {
  if (!error) return 'other'

  const message = (error.message || '').toLowerCase()
  const code = error.code

  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('rate exceeded') ||
    code === 429
  ) {
    return 'rate_limit'
  }

  if (
    message.includes('forbidden') ||
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('authentication failed') ||
    code === 403 ||
    code === 401
  ) {
    return 'auth_error'
  }

  if (message.includes('timeout')) {
    return 'timeout'
  }

  return 'other'
}

export function calculateBlacklistUntil(
  errorType: 'rate_limit' | 'auth_error' | 'timeout' | 'other' | undefined,
  now: number
): number | undefined {
  if (!errorType) return undefined

  switch (errorType) {
    case 'rate_limit':
      return now + RATE_LIMIT_BLACKLIST_DURATION
    case 'auth_error':
      return now + AUTH_ERROR_BLACKLIST_DURATION
    case 'timeout':
      return now + TIMEOUT_BLACKLIST_DURATION
    case 'other':
      return now + OTHER_ERROR_BLACKLIST_DURATION
    default:
      return undefined
  }
}
