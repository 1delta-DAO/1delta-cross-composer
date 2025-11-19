import { Abi, encodeFunctionData, parseAbiItem, zeroAddress, type Address, type Hex } from "viem"
import { encodeTransferIn, encodeApprove, encodeSweep, encodeTryExternalCallWithReplace, encodeExternalCall, SweepType } from "@1delta/calldatalib"
import { packCommands } from "@1delta/lib-utils"
import { XCDOT_ADDRESS, STELLA_STDOT_ADDRESS } from "../consts"

const encodeAmount = (amount: bigint): Hex => {
  const calldata = encodeFunctionData({ abi: [parseAbiItem("function deposit(uint256 amount)")] as Abi, functionName: "deposit", args: [amount] })
  console.log("calldata", calldata)
  return calldata
}
export function encodeStellaDotStakingComposerCalldata(amount: bigint, userAddress: Address, callForwarderAddress: Address): Hex {
  const approveCalldata = encodeApprove(XCDOT_ADDRESS, STELLA_STDOT_ADDRESS)

  const catchCalldata = encodeSweep(XCDOT_ADDRESS, userAddress, 0n, SweepType.VALIDATE)

  const tryCallCalldata = encodeTryExternalCallWithReplace(
    STELLA_STDOT_ADDRESS,
    0n,
    false,
    amount === 0n ? XCDOT_ADDRESS : zeroAddress,
    0,
    encodeAmount(amount),
    false,
    catchCalldata,
  )

  const finalSweepCalldata = encodeSweep(STELLA_STDOT_ADDRESS, userAddress, 0n, SweepType.VALIDATE)

  const forwarderInnerCalldata = packCommands([approveCalldata, tryCallCalldata, finalSweepCalldata]) as Hex

  const forwarderCalldata = encodeExternalCall(callForwarderAddress, 0n, false, forwarderInnerCalldata)

  const deltaComposeCalldata = encodeFunctionData({
    abi: [parseAbiItem("function deltaCompose(bytes calldata) external payable")] as Abi,
    functionName: "deltaCompose",
    args: [forwarderCalldata],
  })

  return deltaComposeCalldata as Hex
}
