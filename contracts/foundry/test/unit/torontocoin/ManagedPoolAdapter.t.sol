// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ManagedPoolAdapter} from "../../../src/torontocoin/ManagedPoolAdapter.sol";
import {PoolRegistry} from "../../../src/torontocoin/PoolRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ManagedPoolAdapterTest is Test {
    bytes32 private constant POOL_ID = keccak256("pool-a");
    bytes32 private constant MERCHANT_ID = keccak256("merchant-a");

    PoolRegistry private poolRegistry;
    ManagedPoolAdapter private adapter;
    MockERC20 private mrTcoin;
    MockERC20 private cplTcoin;

    address private recipient = address(0xBEEF);
    address private router = address(0xCAFE);

    function setUp() public {
        poolRegistry = new PoolRegistry(address(this), address(this));
        poolRegistry.addPool(POOL_ID, "Pool A", "pool-a");
        poolRegistry.approveMerchant(MERCHANT_ID, POOL_ID, "merchant-a", new address[](0));

        mrTcoin = new MockERC20("mrTCOIN", "MRT", 6);
        cplTcoin = new MockERC20("cplTCOIN", "CPL", 6);

        adapter = new ManagedPoolAdapter(
            address(this), address(this), address(poolRegistry), address(mrTcoin), address(cplTcoin)
        );
        adapter.createPoolAccount(POOL_ID);
        adapter.setPoolQuoteBps(POOL_ID, 9_500);
        adapter.setPoolExecutionEnabled(POOL_ID, true);

        cplTcoin.mint(adapter.getPoolAccount(POOL_ID), 1_000e6);
    }

    function test_GetPoolLiquidityStateReadsManagedInventory() public view {
        (uint256 mrLiquidity, uint256 cplLiquidity, bool active) = adapter.getPoolLiquidityState(POOL_ID);

        assertEq(mrLiquidity, 0);
        assertEq(cplLiquidity, 1_000e6);
        assertTrue(active);
    }

    function test_PreviewBuyClampsToAvailableLiquidity() public {
        adapter.setPoolQuoteBps(POOL_ID, 10_000);
        uint256 quoted = adapter.previewBuyCplTcoinFromPool(POOL_ID, 1_500e6);
        assertEq(quoted, 1_000e6);
    }

    function test_BuyTransfersMrTcoinIntoPoolInventoryAndCplTcoinToRecipient() public {
        mrTcoin.mint(router, 100e6);

        vm.startPrank(router);
        mrTcoin.approve(address(adapter), type(uint256).max);
        uint256 cplOut = adapter.buyCplTcoinFromPool(POOL_ID, 100e6, 95e6, recipient);
        vm.stopPrank();

        assertEq(cplOut, 95e6);
        assertEq(cplTcoin.balanceOf(recipient), 95e6);
        assertEq(mrTcoin.balanceOf(adapter.getPoolAccount(POOL_ID)), 100e6);
        assertEq(cplTcoin.balanceOf(adapter.getPoolAccount(POOL_ID)), 905e6);
    }

    function test_PoolMatchesMerchantIdsUsesRegistryMapping() public view {
        bytes32[] memory merchantIds = new bytes32[](1);
        merchantIds[0] = MERCHANT_ID;

        assertTrue(adapter.poolMatchesAnyMerchantIds(POOL_ID, merchantIds));
        assertFalse(adapter.poolMatchesAnyMerchantIds(keccak256("pool-b"), merchantIds));
    }
}
