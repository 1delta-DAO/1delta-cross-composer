import { getViemProvider } from "@1delta/lib-utils/dist/services/provider/viemProvider"
import { ChainEnum } from "../data/chains"

export async function getPublicClientForChain(chainId: string) {
    try {
        return await getViemProvider({ chainId })
    } catch (e) {
        console.warn(`Failed to acquire provider for chainId ${chainId}`, e)
        return undefined
    }
}
