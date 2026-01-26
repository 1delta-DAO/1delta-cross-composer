import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { moonbeam } from 'wagmi/chains'
import { fallback, http } from 'wagmi'
import { getAvailableChainIds, SupportedChainId } from '@1delta/lib-utils'
import { getEvmChain } from '@1delta/providers'

// auto-inititalize chains based on state
export const evmChainWagmi: any[] = getAvailableChainIds()
  .filter((a) => a !== SupportedChainId.FUEL)
  .map((chainId) => getEvmChain(chainId))

const RPC_OVERRIDES = {
  [SupportedChainId.BNB_SMART_CHAIN_MAINNET]: 'https://bsc-dataseed1.bnbchain.org',
  [SupportedChainId.METIS_ANDROMEDA_MAINNET]: 'https://metis-andromeda.rpc.thirdweb.com',
}

export const evmTransportsWagmi = Object.assign(
  {},
  ...evmChainWagmi.map(({ id, rpcUrls }) => {
    return {
      [id]: http(
        // @ts-ignore
        RPC_OVERRIDES[String(id)] ?? rpcUrls.default.http[0]
      ),
    }
  })
)

export const config = getDefaultConfig({
  appName: '1delta Cross Composer',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
  chains: evmChainWagmi as any,
  transports: {
    ...evmTransportsWagmi,
    [moonbeam.id]: fallback(
      [
        http('https://moonbeam.unitedbloc.com'),
        http('https://1rpc.io/glmr'),
        http('https://moonbeam-rpc.dwellir.com'),
        http('https://moonbeam-rpc.publicnode.com'),
        http('https://moonbeam.drpc.org'),
        http('https://endpoints.omniatech.io/v1/moonbeam/mainnet/public'),
        http('https://rpc.api.moonbeam.network'),
        http('https://rpc.poolz.finance/moonbeam'),
        http('https://moonbeam.rpc.grove.city/v1/01fdb492'),
        http('https://moonbeam.api.onfinality.io/public'),
      ],
      { rank: true, retryCount: 2 }
    ),
  },
  ssr: false,
})
