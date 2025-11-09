import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { useState } from "react"
import type { Hex } from "viem"
// Removed TabSelector; use segmented buttons like Uniswap
import BatchTransactionForm from "./components/BatchTransactionForm"
import { SwapTab } from "./components/swap/SwapTab"
import { TradeSdkWalletSync } from "./lib/trade-sdk/walletClient"
import { SwapSlippageSelector } from "./components/swap/SwapSlippageSelector"

export default function App() {
    const { address, isConnected } = useAccount()
    const [activeTab, setActiveTab] = useState<"swap" | "transactions">("swap")
    const [transactionHash, setTransactionHash] = useState<Hex | null>(null)

    const handleTransactionExecuted = (hash: Hex) => setTransactionHash(hash)
    const handleReset = () => setTransactionHash(null)

    return (
        <div className="min-h-screen bg-base-200" data-theme="moonbeam">
            <TradeSdkWalletSync />
            <div className="navbar bg-base-100 shadow-lg">
                <div className="flex flex-row p-2 flex-grow">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Moonbeamer
                            </h1>
                        </div>
                    </div>
                    <div className="flex-none">
                        <ConnectButton />
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {!isConnected ? (
                    <div className="hero min-h-[60vh]">
                        <div className="flex flex-col items-center justify-center">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                                Connect Your Wallet
                            </h1>
                            <ConnectButton />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 flex flex-col items-center">
                        <div className="w-full max-w-[500px] min-w-[300px] flex items-center justify-between">
                            <div className="join">
                                <button
                                    className={`btn btn-sm join-item ${activeTab === "swap" ? "btn-primary" : "btn-ghost"}`}
                                    onClick={() => setActiveTab("swap")}
                                >
                                    Swap
                                </button>
                                <button
                                    className={`btn btn-sm join-item ${activeTab === "transactions" ? "btn-primary" : "btn-ghost"}`}
                                    onClick={() => setActiveTab("transactions")}
                                >
                                    Transactions
                                </button>
                            </div>
                            {activeTab === "swap" && <SwapSlippageSelector />}
                        </div>
                        <div className="w-full max-w-[500px] min-w-[300px]">
                            <div className="card bg-[#131313] shadow-xl rounded-2xl">
                                <div className="card-body p-4 sm:p-6">
                                    {activeTab === "swap" ? (
                                        <SwapTab userAddress={address ?? undefined} />
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
                                                            <p className="flex-1 font-mono text-s w-10/11 text-white border rounded-md p-2">
                                                                {transactionHash}
                                                            </p>
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
                )}
            </main>
        </div>
    )
}
