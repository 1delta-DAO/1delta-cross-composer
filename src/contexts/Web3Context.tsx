import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAccount, useChainId } from 'wagmi'
import type { Address } from 'viem'
import { useChainsRegistry, type ChainsRegistryRecord } from '../sdk/hooks/useChainsRegistry'
import { useTokenLists, type TokenListsRecord } from '../hooks/useTokenLists'

export interface Web3ContextValue {
  address: Address | undefined
  isConnected: boolean
  currentChainId: number
  chains: ChainsRegistryRecord | undefined
  chainsLoading: boolean
  chainsError: Error | null
  tokenLists: TokenListsRecord
  tokenListsLoading: boolean
}

const Web3Context = createContext<Web3ContextValue | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const currentChainId = useChainId()
  const { data: chains, isLoading: chainsLoading, error: chainsError } = useChainsRegistry()
  const { data: lists, isLoading: tokenListsLoading } = useTokenLists()

  const value = useMemo<Web3ContextValue>(
    () => ({
      address,
      isConnected,
      currentChainId,
      chains,
      chainsLoading,
      chainsError: chainsError || null,
      tokenLists: lists || ({} as TokenListsRecord),
      tokenListsLoading,
    }),
    [
      address,
      isConnected,
      currentChainId,
      chains,
      chainsLoading,
      chainsError,
      lists,
      tokenListsLoading,
    ]
  )

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>
}

export function useWeb3(): Web3ContextValue {
  const context = useContext(Web3Context)
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider')
  }
  return context
}
