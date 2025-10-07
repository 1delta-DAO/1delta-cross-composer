// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/interfaces/IBatch.sol";
import "../src/interfaces/ICallPermit.sol";
import {IERC20} from "openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import "forge-std/Vm.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

contract PermitBatchTestTest is Test {
    address constant BATCH_PRECOMPILE =
        0x0000000000000000000000000000000000000808;
    address constant CALL_PERMIT_PRECOMPILE =
        0x000000000000000000000000000000000000080a;
    address constant xcUSDC = 0xFFfffffF7D2B0B761Af01Ca8e25242976ac0aD7D;

    IERC20 token;
    Batch batch;
    CallPermit permit;

    Vm.Wallet user1;
    Vm.Wallet user2;
    Vm.Wallet user3;

    function setUp() public {
        batch = Batch(BATCH_PRECOMPILE);
        permit = CallPermit(CALL_PERMIT_PRECOMPILE);
        token = IERC20(xcUSDC);

        user1 = vm.createWallet("user1");
        user2 = vm.createWallet("user2");
        user3 = vm.createWallet("user3");

        vm.label(BATCH_PRECOMPILE, "BATCH_PRECOMPILE");
        vm.label(CALL_PERMIT_PRECOMPILE, "CALL_PERMIT_PRECOMPILE");
        vm.label(xcUSDC, "xcUSDC");
        vm.label(user1.addr, "user1");
        vm.label(user2.addr, "user2");
        vm.label(user3.addr, "user3");
        vm.label(address(this), "TestContract");

        vm.deal(user1.addr, 10 ether);
        vm.deal(user2.addr, 10 ether);
        vm.deal(user3.addr, 10 ether);

        deal(xcUSDC, user1.addr, 1e12);
        deal(xcUSDC, address(this), 1e12);

        token.approve(user1.addr, 10e6);
    }

    function testPermit() public {
        address[] memory targets = new address[](3);
        uint256[] memory values = new uint256[](3);
        bytes[] memory callData = new bytes[](3);
        uint64[] memory gasLimits = new uint64[](3);

        // approve test contract for 10 usdc
        targets[0] = xcUSDC;
        values[0] = 0;
        callData[0] = abi.encodeWithSelector(
            IERC20.approve.selector,
            address(this),
            10e6 // 10usdc
        );

        // transfer 10 usdc from user1 to user2
        targets[1] = xcUSDC;
        values[1] = 0;
        callData[1] = abi.encodeWithSelector(
            IERC20.transfer.selector,
            user2.addr,
            10e6 // 10usdc
        );

        // do transfer from
        targets[2] = xcUSDC;
        values[2] = 0;
        callData[2] = abi.encodeWithSelector(
            IERC20.transferFrom.selector,
            address(this),
            user3.addr,
            10e6 // 10usdc
        );

        bytes32 permitTypeHash = keccak256(
            "CallPermit(address from,address to,uint256 value,bytes data,uint64 gaslimit,uint256 nonce,uint256 deadline)"
        );
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = permit.nonces(user1.addr);
        bytes32 domainSeparator = permit.DOMAIN_SEPARATOR();

        bytes memory batchCalldata = abi.encodeWithSelector(
            Batch.batchAll.selector,
            targets,
            values,
            callData,
            gasLimits
        );

        bytes32 structHash = keccak256(
            abi.encode(
                permitTypeHash,
                user1.addr,
                BATCH_PRECOMPILE,
                0,
                keccak256(batchCalldata),
                uint64(1000000),
                nonce,
                deadline
            )
        );

        bytes32 digest = MessageHashUtils.toTypedDataHash(
            domainSeparator,
            structHash
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1.privateKey, digest);

        vm.prank(user1.addr);
        permit.dispatch(
            user1.addr,
            BATCH_PRECOMPILE,
            0,
            batchCalldata,
            1000000,
            deadline,
            v,
            r,
            s
        );
    }
}
