// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PoolRegistry} from "../../../src/torontocoin/PoolRegistry.sol";
import {SarafuSwapPoolAdapter} from "../../../src/torontocoin/SarafuSwapPoolAdapter.sol";
import {Limiter} from "../../../src/sarafu-read-only/Limiter.sol";
import {PriceIndexQuoter} from "../../../src/sarafu-read-only/PriceIndexQuoter.sol";
import {SwapPool} from "../../../src/sarafu-read-only/SwapPool.sol";
import {TokenUniqueSymbolIndex} from "../../../src/sarafu-read-only/TokenUniqueSymbolIndex.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract SarafuSwapPoolAdapterTest is Test {
    bytes32 private constant POOL_ID = keccak256("pool-a");
    bytes32 private constant MERCHANT_ID = keccak256("merchant-a");

    PoolRegistry private poolRegistry;
    TokenUniqueSymbolIndex private tokenRegistry;
    Limiter private limiter;
    PriceIndexQuoter private quoter;
    SwapPool private swapPool;
    SarafuSwapPoolAdapter private adapter;
    MockERC20 private mrTcoin;
    MockERC20 private cplTcoin;

    address private constant RECIPIENT = address(0xBEEF);
    address private constant ROUTER = address(0xCAFE);

    function setUp() public {
        poolRegistry = new PoolRegistry(address(this), address(this));
        poolRegistry.addPool(POOL_ID, "Pool A", "pool-a");

        tokenRegistry = new TokenUniqueSymbolIndex();
        limiter = new Limiter();
        quoter = new PriceIndexQuoter();
        swapPool = new SwapPool("Pool A", "PA", 6, address(tokenRegistry), address(limiter));
        swapPool.setQuoter(address(quoter));

        mrTcoin = new MockERC20("mrTCOIN", "MRT", 6);
        cplTcoin = new MockERC20("cplTCOIN", "CPL", 6);

        tokenRegistry.addWriter(address(this));
        tokenRegistry.register(address(mrTcoin));
        tokenRegistry.register(address(cplTcoin));

        poolRegistry.setPoolAddress(POOL_ID, address(swapPool));
        poolRegistry.approveMerchant(MERCHANT_ID, POOL_ID, "merchant-a", new address[](0));

        limiter.setLimitFor(address(mrTcoin), address(swapPool), 1_000_000e6);
        limiter.setLimitFor(address(cplTcoin), address(swapPool), 1_000_000e6);

        adapter = new SarafuSwapPoolAdapter(
            address(this), address(this), address(poolRegistry), address(mrTcoin), address(cplTcoin)
        );

        cplTcoin.mint(address(this), 1_000e6);
        cplTcoin.approve(address(swapPool), type(uint256).max);
        swapPool.deposit(address(cplTcoin), 1_000e6);
    }

    function test_GetPoolLiquidityStateReadsSarafuPoolBalances() public view {
        (uint256 mrLiquidity, uint256 cplLiquidity, bool active) = adapter.getPoolLiquidityState(POOL_ID);

        assertEq(mrLiquidity, 0);
        assertEq(cplLiquidity, 1_000e6);
        assertTrue(active);
    }

    function test_PreviewBuyUsesSwapPoolQuoteAndClampsToAvailableLiquidity() public view {
        uint256 quoted = adapter.previewBuyCplTcoinFromPool(POOL_ID, 1_500e6);
        assertEq(quoted, 1_000e6);
    }

    function test_BuyTransfersMrTcoinIntoSwapPoolAndCplTcoinToRecipient() public {
        mrTcoin.mint(ROUTER, 100e6);

        vm.startPrank(ROUTER);
        mrTcoin.approve(address(adapter), type(uint256).max);
        uint256 cplOut = adapter.buyCplTcoinFromPool(POOL_ID, 100e6, 100e6, RECIPIENT);
        vm.stopPrank();

        assertEq(cplOut, 100e6);
        assertEq(cplTcoin.balanceOf(RECIPIENT), 100e6);
        assertEq(mrTcoin.balanceOf(address(swapPool)), 100e6);
        assertEq(cplTcoin.balanceOf(address(swapPool)), 900e6);
    }

    function test_PoolMatchesMerchantIdsUsesRegistryMapping() public view {
        bytes32[] memory merchantIds = new bytes32[](1);
        merchantIds[0] = MERCHANT_ID;

        assertTrue(adapter.poolMatchesAnyMerchantIds(POOL_ID, merchantIds));
        assertFalse(adapter.poolMatchesAnyMerchantIds(keccak256("pool-b"), merchantIds));
    }
}
