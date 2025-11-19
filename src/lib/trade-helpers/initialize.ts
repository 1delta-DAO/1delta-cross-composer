import { initialize as initTradeSdk, setWalletClient as setTradeSdkWalletClient } from "@1delta/trade-sdk"
import type { WalletClient } from "viem"
import { initializeMoonwellMarkets } from "../moonwell/marketCache"

let isInitialized = false

export async function initAll() {
  if (isInitialized) {
    return
  }

  // init Moonwell markets cache on app startup
  initializeMoonwellMarkets().catch((error) => {
    console.error("Failed to initialize Moonwell markets:", error)
  })

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
