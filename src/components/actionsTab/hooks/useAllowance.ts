import { useMemo } from 'react'
import { Address, erc20Abi, zeroAddress } from 'viem'
import { useReadContract } from 'wagmi'

export function useAllowance(
  account: Address | undefined,
  srcTokenAddress: Address,
  spender: Address,
  amountWei: string | undefined,
  skipApprove = true
) {
  const { data: currentAllowance } = useReadContract({
    address: srcTokenAddress && srcTokenAddress !== zeroAddress ? srcTokenAddress : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account && spender ? [account, spender] : undefined,
    query: {
      enabled: Boolean(
        srcTokenAddress && account && spender && srcTokenAddress !== zeroAddress && !skipApprove
      ),
    },
  })
  const needsApproval = useMemo(() => {
    if (!srcTokenAddress || srcTokenAddress === zeroAddress || !spender || skipApprove) {
      return false
    }
    if (!amountWei) return false
    if (currentAllowance === undefined) return true
    return currentAllowance < BigInt(amountWei)
  }, [srcTokenAddress, spender, amountWei, currentAllowance, skipApprove])

  return { currentAllowance, needsApproval }
}
