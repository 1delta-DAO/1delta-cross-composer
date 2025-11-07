import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { arbitrum, avalanche, base, mainnet, mantle, moonbeam, plasma, polygon } from "wagmi/chains"

export const config = getDefaultConfig({
    appName: "Moonbeamer",
    projectId: "id",
    chains: [arbitrum, avalanche, base, mainnet, mantle, moonbeam, plasma, polygon],
    ssr: false,
})
