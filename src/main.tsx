import React from "react"
import ReactDOM from "react-dom/client"
import "./styles/globals.css"
import "@rainbow-me/rainbowkit/styles.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { config } from "./wagmi"
import App from "./App"
import { ToastProvider } from "./components/common/ToastHost"
import { SlippageProvider } from "./contexts/SlippageContext"
import { TxHistoryProvider } from "./contexts/TxHistoryContext"
import { initAll } from "./lib/trade-helpers/initialize"
import { rainbowDaisyTheme } from "./rainbowkitTheme"

const client = new QueryClient()

// init trade-sdk and moonwell markets on app startup
initAll().catch((error) => {
  console.error("Failed to initialize Trade SDK:", error)
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider theme={rainbowDaisyTheme}>
          <ToastProvider>
            <SlippageProvider>
              <TxHistoryProvider>
                <App />
              </TxHistoryProvider>
            </SlippageProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
