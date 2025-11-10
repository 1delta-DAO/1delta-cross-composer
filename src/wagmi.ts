import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { arbitrum, avalanche, base, mainnet, mantle, moonbeam, plasma, polygon } from "wagmi/chains"
import { fallback, http } from "wagmi"

export const config = getDefaultConfig({
    appName: "Moonbeamer",
    projectId: "id",
    chains: [arbitrum, avalanche, base, mainnet, mantle, moonbeam, plasma, polygon],
    transports: {
        [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
        [base.id]: http("https://base-rpc.publicnode.com"),
        [polygon.id]: http("https://polygon-bor-rpc.publicnode.com"),
        [arbitrum.id]: http("https://arbitrum-one-rpc.publicnode.com"),
        [avalanche.id]: http("https://avalanche.drpc.org"),
        [mantle.id]: http("https://mantle.drpc.org"),
        [plasma.id]: http("https://plasma.drpc.org"),
        [moonbeam.id]: fallback(
            [
                http("https://moonbeam.unitedbloc.com"),
                http("https://1rpc.io/glmr"),
                http("https://moonbeam-rpc.dwellir.com"),
                http("https://moonbeam-rpc.publicnode.com"),
                http("https://moonbeam.drpc.org"),
                http("https://endpoints.omniatech.io/v1/moonbeam/mainnet/public"),
                http("https://rpc.api.moonbeam.network"),
                http("https://rpc.poolz.finance/moonbeam"),
                http("https://moonbeam.rpc.grove.city/v1/01fdb492"),
                http("https://moonbeam.api.onfinality.io/public"),
            ],
            { rank: true, retryCount: 2 }
        ),
    },
    ssr: false,
})
