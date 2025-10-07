// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TestCaller} from "../src/TestCaller.sol";
import {Script} from "forge-std/Script.sol";

contract Deploy is Script {
    function run() public {
        vm.startBroadcast();
        new TestCaller();
        vm.stopBroadcast();
    }
}
