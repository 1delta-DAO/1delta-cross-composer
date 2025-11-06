import React from "react"
import ReactDOM from "react-dom/client"
import "./styles/globals.css"
import "@rainbow-me/rainbowkit/styles.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import { config } from "./wagmi"
import App from "./App"
import { ToastProvider } from "./components/common/ToastHost"
import { initializeTradeSdk } from "./lib/trade-sdk/initialize"

const client = new QueryClient()

// init trade-sdk on app startup
initializeTradeSdk().catch((error) => {
    console.error("Failed to initialize Trade SDK:", error)
})

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <WagmiProvider config={config}>
            <QueryClientProvider client={client}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: "#6366f1",
                        accentColorForeground: "white",
                        borderRadius: "medium",
                        fontStack: "system",
                        overlayBlur: "small",
                    })}
                >
                    <ToastProvider>
                        <App />
                    </ToastProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>
)
