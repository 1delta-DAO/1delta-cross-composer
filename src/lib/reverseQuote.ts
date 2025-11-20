import { skimToBigNumber } from "@1delta/lib-utils"
import { formatUnits } from "viem"

export function reverseQuote(decimalsIn: number, decimalsOut: number, amountOut: string | bigint, priceIn: number, priceOut: number) {
  const mos = 0.003 // 30bps
  const amOutNr = Number(formatUnits(BigInt(amountOut ?? 0), decimalsOut))
  const amIn = ((amOutNr * priceOut) / priceIn) * (1 + mos)
  const am = skimToBigNumber(amIn, decimalsIn)
  return am
}
