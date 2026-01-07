import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { config } from './wagmi'
import App from './App'
import { ToastProvider } from './components/common/ToastHost'
import { Web3Provider } from './contexts/Web3Context'
import { SlippageProvider } from './contexts/SlippageContext'
import { TxHistoryProvider } from './contexts/TxHistoryContext'
import { QuoteTraceProvider } from './contexts/QuoteTraceContext'
import { rainbowDaisyTheme } from './rainbowkitTheme'
import { initAll } from './initialize'

const client = new QueryClient()

function RootApp() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setError(null)

    initAll()
      .then(() => {
        if (cancelled) return
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to initialize application:', err)
        setError(err instanceof Error ? err : new Error('Failed to initialize application'))
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [retryCount])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg" />
          <p className="text-sm text-base-content/70">Initializing application...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="max-w-sm w-full card bg-base-100 shadow-xl">
          <div className="card-body items-center text-center gap-4">
            <h2 className="card-title text-error">Initialization failed</h2>
            <p className="text-sm text-base-content/70">
              {(error && error.message) || 'Something went wrong while starting the app.'}
            </p>
            <div className="card-actions justify-center">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setRetryCount((x) => x + 1)}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider theme={rainbowDaisyTheme}>
          <Web3Provider>
            <ToastProvider>
              <SlippageProvider>
                <TxHistoryProvider>
                  <QuoteTraceProvider>
                    <RootApp />
                  </QuoteTraceProvider>
                </TxHistoryProvider>
              </SlippageProvider>
            </ToastProvider>
          </Web3Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
