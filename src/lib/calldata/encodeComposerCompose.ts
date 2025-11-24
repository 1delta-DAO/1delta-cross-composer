import { encodeFunctionData, Hex } from "viem"
import { COMPOSER_ABI } from "../abi/Composer"

export const encodeComposerCompose = (calldata: Hex) => {
  return encodeFunctionData({
    abi: COMPOSER_ABI,
    functionName: "deltaCompose",
    args: [calldata],
  })
}
