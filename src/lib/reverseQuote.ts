import { formatUnits } from "viem"

export function reverseQuote(decimalsOut: number, amountOut: string | bigint, priceIn: number, priceOut: number) {
  const mos = 0.003 // 30bps
  const amOutNr = Number(formatUnits(BigInt(amountOut ?? 0), decimalsOut))
  const amIn = ((amOutNr * priceOut) / priceIn) * (1 + mos)
  return amIn.toString()
}
