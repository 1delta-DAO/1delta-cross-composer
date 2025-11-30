import { useEffect } from 'react'
import { useWalletClient } from 'wagmi'
import { setTradeSdkWallet } from '../../initialize'

export function TradeSdkWalletSync() {
  const { data: walletClient } = useWalletClient()

  useEffect(() => {
    setTradeSdkWallet(walletClient)
  }, [walletClient])

  return null
}
