import {
  initialize as initTradeSdk,
  setWalletClient as setTradeSdkWalletClient,
} from '@1delta/trade-sdk'
import type { WalletClient } from 'viem'

import { registerActions } from './components/actions/shared/registerActions'
import { fetchMainPrices } from './hooks/prices/usePriceQuery'
import { loadTokenLists } from './lib/data/tokenListsCache'
import { initializeMoonwellMarkets } from './components/actions/lending/deposit/marketCache'

let isInitialized = false

export async function initAll() {
  if (isInitialized) {
    return
  }

  // init actions
  registerActions()

  // init Moonwell markets cache on app startup
  initializeMoonwellMarkets().catch((error) => {
    console.error('Failed to initialize Moonwell markets:', error)
  })

  try {
    const isProd = import.meta.env?.VITE_ENVIRONMENT === 'production' || true

    await initTradeSdk({
      isProductionEnv: isProd,
      loadChainData: true,
      loadSquidData: true,
      load1deltaConfigs: true,
    })

    await loadTokenLists()

    isInitialized = true
    console.debug('Trade SDK and asset lists initialized successfully')
  } catch (error) {
    console.error('Failed to initialize core services:', error)
    throw error
  }

  await fetchMainPrices()
    .then(() => {
      console.debug('Main prices fetched successfully')
    })
    .catch((error) => {
      console.error('Failed to fetch main prices:', error)
    })
}

export function setTradeSdkWallet(walletClient: WalletClient | undefined) {
  if (walletClient) {
    setTradeSdkWalletClient(walletClient)
  }
}
