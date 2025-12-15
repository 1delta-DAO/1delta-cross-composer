import { useCallback } from 'react'
import { useSwitchChain, useChainId } from 'wagmi'
import { useToast } from '../../common/ToastHost'

export function useSyncChain() {
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const toast = useToast()
  const syncChain = useCallback(
    async (targetChainId: number) => {
      if (currentChainId === targetChainId) return true

      try {
        await switchChainAsync({ chainId: targetChainId })
        return true
      } catch (err) {
        toast.showError(`Please switch to chain ${targetChainId}`)
        return false
      }
    },
    [currentChainId, switchChainAsync]
  )

  return { syncChain, currentChainId }
}
