// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Batch} from "./interfaces/IBatch.sol";
import {CallPermit} from "./interfaces/ICallPermit.sol";

contract TestCaller {
    function call(address target, bytes calldata data) external payable {
        (bool success, ) = target.call{value: msg.value}(data);
        require(success, "call failed");
    }

    function permitCall(
        address from,
        address to,
        uint256 value,
        bytes memory data,
        uint64 gaslimit,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable returns (bytes memory) {
        return
            CallPermit(0x000000000000000000000000000000000000080a).dispatch(
                from,
                to,
                value,
                data,
                gaslimit,
                deadline,
                v,
                r,
                s
            );
    }

    function batchCall(
        address[] memory to,
        uint256[] memory value,
        bytes[] memory callData,
        uint64[] memory gasLimit
    ) external payable {
        Batch(0x0000000000000000000000000000000000000808).batchAll(
            to,
            value,
            callData,
            gasLimit
        );
    }
}
