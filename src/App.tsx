import { useAccount } from "wagmi"
import { useState } from "react"
import type { Hex } from "viem"
import BatchTransactionForm from "./components/BatchTransactionForm"
import { SwapTab } from "./components/swap/SwapTab"
import { TradeSdkWalletSync } from "./lib/trade-helpers/walletClient"
import { SwapSlippageSelector } from "./components/swap/SwapSlippageSelector"
import { ThemeSwitcher } from "./components/themeSwitcher"
import { WalletConnect } from "./components/connect"
import { TxHistoryButton } from "./components/history/TxHistoryButton"

export default function App() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<"swap" | "transactions">("swap")
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null)
  const [showSwapReset, setShowSwapReset] = useState(false)
  const [swapResetCallback, setSwapResetCallback] = useState<(() => void) | null>(null)

  const handleTransactionExecuted = (hash: Hex) => setTransactionHash(hash)
  const handleReset = () => setTransactionHash(null)

  const handleSwapReset = () => {
    if (swapResetCallback) swapResetCallback()
    setShowSwapReset(false)
  }

  return (
    <div className="min-h-screen bg-base-200">
      <TradeSdkWalletSync />

      {/* NAVBAR */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex flex-row p-2 grow">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              {/* Use theme primary instead of fixed gradient */}
              <h1 className="text-2xl font-bold text-primary">MOONBEAMER</h1>
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
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 flex flex-col items-center">
          {/* TABS + SLIPPAGE */}
          <div className="w-full max-w-[500px] min-w-[300px] flex items-center justify-between">
            <div className="join">
              <button className={`btn btn-sm join-item ${activeTab === "swap" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActiveTab("swap")}>
                Swap
              </button>
              <button
                className={`btn btn-sm join-item ${activeTab === "transactions" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveTab("transactions")}
              >
                Transactions
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === "swap" && <SwapSlippageSelector />}
              {activeTab === "swap" && showSwapReset && (
                <button className="btn btn-ghost btn-xs" onClick={handleSwapReset}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
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
          <div className="w-full max-w-[500px] min-w-[300px]">
            <div className="card bg-base-100 shadow-xl rounded-2xl">
              <div className="card-body p-4 sm:p-6">
                {activeTab === "swap" ? (
                  <SwapTab
                    userAddress={address ?? undefined}
                    onResetStateChange={(showReset, resetCallback) => {
                      setShowSwapReset(showReset)
                      setSwapResetCallback(resetCallback || null)
                    }}
                  />
                ) : transactionHash ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="card-title text-2xl">Transaction Executed</h2>
                      <div className="badge badge-success badge-lg">Success</div>
                    </div>

                    <div className="space-y-6">
                      <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                          <h3 className="card-title text-lg">Transaction Hash</h3>
                          <div className="flex flex-row gap-2 items-center pt-2">
                            <p className="flex-1 font-mono text-s w-10/11 border rounded-md p-2">{transactionHash}</p>
                          </div>
                        </div>
                      </div>

                      <div className="card-actions justify-between">
                        <button onClick={handleReset} className="btn btn-outline btn-secondary">
                          Reset
                        </button>
                        <button onClick={handleReset} className="btn btn-primary btn-lg">
                          Create New Transaction
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <BatchTransactionForm onTransactionExecuted={handleTransactionExecuted} />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
