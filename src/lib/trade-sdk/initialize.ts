import { initialize as initTradeSdk, setWalletClient as setTradeSdkWalletClient } from "@1delta/trade-sdk"
import type { WalletClient } from "viem"

let isInitialized = false

export async function initializeTradeSdk() {
    if (isInitialized) {
        return
    }

    try {
        await initTradeSdk({
            isProductionEnv: false,
            loadChainData: true,
            loadSquidData: true,
            load1deltaConfigs: true,
        })
        isInitialized = true
        console.debug("Trade SDK initialized successfully")
    } catch (error) {
        console.error("Failed to initialize Trade SDK:", error)
        throw error
    }
}

export function setTradeSdkWallet(walletClient: WalletClient | undefined) {
    if (walletClient) {
        setTradeSdkWalletClient(walletClient)
    }
}
