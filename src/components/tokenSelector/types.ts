import { Address } from "viem"

export type TokenRowData = {
  addr: Address
  token: any
  usdValue: number
  price: number
  balanceAmount: number
  category: number
  isRelevant: boolean
}

export type CommonViewProps = {
  chainId: string
  chains: any
  relevant: Address[]
  rows: TokenRowData[]
  tokensMap: Record<string, any>
  balances: any
  prices: any
  balancesLoading: boolean
  pricesLoading: boolean
  userAddress?: Address
  onChange: (addr: Address) => void
}
