import { useState } from 'react'
import { ActionsTab } from './components/actionsTab/ActionsTab'
import { ReverseActionsTab } from './components/actionsTab/ReverseActionsTab'
import { TradeSdkWalletSync } from './lib/trade-helpers/walletClient'
import { SwapSlippageSelector } from './components/actionsTab/SwapSlippageSelector'
import { ThemeSwitcher } from './components/themeSwitcher'
import { WalletConnect } from './components/connect'
import { TxHistoryButton } from './components/history/TxHistoryButton'
import { QuoteTracePanel } from './components/debug/QuoteTracePanel'
import { DestinationInfoProvider } from './contexts/DestinationInfoContext'
import { TradeProvider, useTradeContext } from './contexts/TradeContext'

export default function App() {
  const [showSwapReset, setShowSwapReset] = useState(false)
  const [swapResetCallback, setSwapResetCallback] = useState<(() => void) | null>(null)

  const handleSwapReset = () => {
    if (swapResetCallback) swapResetCallback()
    setShowSwapReset(false)
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <TradeSdkWalletSync />

      {/* NAVBAR */}
      <div className="navbar bg-base-100 shadow-lg shrink-0">
        <div className="flex flex-row p-2 grow">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-primary">1ΔC²</h1>
            </div>
          </div>
          <div className="flex-none flex gap-3 items-center">
            <div className="flex-none flex gap-3 items-center">
              <TxHistoryButton />
              <ThemeSwitcher />
            </div>
            <div className="flex-none flex gap-3 items-center">
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <DestinationInfoProvider>
          <TradeProvider>
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
              <div className="space-y-4 flex flex-col items-center">
                {/* TABS + SLIPPAGE */}
                <div className="w-full max-w-[1000px] min-w-[450px] flex items-center justify-between">
                  <FlowModeSwitcher />

                  <div className="flex items-center gap-2">
                    {<SwapSlippageSelector />}
                    {showSwapReset && (
                      <button className="btn btn-ghost btn-xs" onClick={handleSwapReset}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* CARD */}
                <div className="w-full max-w-[1000px] min-w-[450px]">
                  <div className="card bg-base-100 shadow-xl rounded-2xl">
                    <div className="card-body p-4 sm:p-6">
                      <TabContent
                        onResetStateChange={(showReset, resetCallback) => {
                          setShowSwapReset(showReset)
                          setSwapResetCallback(resetCallback || null)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TradeProvider>
        </DestinationInfoProvider>
      </main>
      <QuoteTracePanel />
    </div>
  )
}

function FlowModeSwitcher() {
  const { flowMode, setFlowMode } = useTradeContext()

  return (
    <div className="flex items-center gap-2">
      <div className="join">
        <button
          className={`btn btn-xs join-item ${flowMode === 'dst' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setFlowMode('dst')}
        >
          Destination Actions
        </button>
        <button
          className={`btn btn-xs join-item ${flowMode === 'src' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setFlowMode('src')}
        >
          Source Actions
        </button>
      </div>
    </div>
  )
}

function TabContent({
  onResetStateChange,
}: {
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}) {
  const { flowMode } = useTradeContext()

  if (flowMode === 'src') {
    return <ReverseActionsTab onResetStateChange={onResetStateChange} />
  }

  return <ActionsTab onResetStateChange={onResetStateChange} />
}
