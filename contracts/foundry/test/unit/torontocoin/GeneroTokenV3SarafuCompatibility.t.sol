// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CharityRegistry} from "../../../src/torontocoin/CharityRegistry.sol";
import {GeneroTokenV3} from "../../../src/torontocoin/GeneroTokenV3.sol";
import {PoolRegistry} from "../../../src/torontocoin/PoolRegistry.sol";
import {UserCharityPreferencesRegistry} from "../../../src/torontocoin/UserCharityPreferencesRegistry.sol";
import {Limiter} from "../../../src/sarafu-read-only/Limiter.sol";
import {PriceIndexQuoter} from "../../../src/sarafu-read-only/PriceIndexQuoter.sol";
import {SwapPool} from "../../../src/sarafu-read-only/SwapPool.sol";
import {TokenUniqueSymbolIndex} from "../../../src/sarafu-read-only/TokenUniqueSymbolIndex.sol";

contract GeneroTokenV3SarafuCompatibilityTest is Test {
    address private constant BUYER = address(0xBEEF);

    CharityRegistry private charityRegistry;
    UserCharityPreferencesRegistry private charityPreferences;
    PoolRegistry private poolRegistry;
    TokenUniqueSymbolIndex private tokenRegistry;
    Limiter private limiter;
    PriceIndexQuoter private quoter;
    SwapPool private swapPool;
    GeneroTokenV3 private mrTcoin;
    GeneroTokenV3 private cplTcoin;

    function setUp() public {
        charityRegistry = new CharityRegistry(address(this), address(this), address(this));
        charityPreferences = new UserCharityPreferencesRegistry(address(this), address(charityRegistry), 1_000);
        poolRegistry = new PoolRegistry(address(this), address(this));
        tokenRegistry = new TokenUniqueSymbolIndex();
        limiter = new Limiter();
        quoter = new PriceIndexQuoter();
        swapPool = new SwapPool("Pool A", "PA", 6, address(tokenRegistry), address(limiter));
        swapPool.setQuoter(address(quoter));

        mrTcoin = new GeneroTokenV3(
            "Municipal Reserve TCOIN",
            "mrTCOIN",
            6,
            int128(int256(uint256(18446735446994636799))),
            43_200,
            address(this),
            address(poolRegistry),
            address(charityPreferences),
            0
        );
        cplTcoin = new GeneroTokenV3(
            "Cross Pool Liquidity TCOIN",
            "cplTCOIN",
            6,
            int128(int256(uint256(18446735446994636799))),
            43_200,
            address(this),
            address(poolRegistry),
            address(charityPreferences),
            100
        );

        mrTcoin.addWriter(address(this));
        cplTcoin.addWriter(address(this));

        tokenRegistry.addWriter(address(this));
        tokenRegistry.register(address(mrTcoin));
        tokenRegistry.register(address(cplTcoin));

        limiter.setLimitFor(address(mrTcoin), address(swapPool), 1_000_000e6);
        limiter.setLimitFor(address(cplTcoin), address(swapPool), 1_000_000e6);

        cplTcoin.mint(address(this), 1_000e6, "");
        cplTcoin.approve(address(swapPool), 1_000e6);
        swapPool.deposit(address(cplTcoin), 1_000e6);

        mrTcoin.mint(BUYER, 100e6, "");
    }

    function test_GeneroTokenV3CanParticipateInSarafuSwapPoolWithdrawals() public {
        vm.startPrank(BUYER);
        mrTcoin.approve(address(swapPool), 100e6);
        swapPool.withdraw(address(cplTcoin), address(mrTcoin), 100e6);
        vm.stopPrank();

        assertEq(cplTcoin.balanceOf(BUYER), 100e6);
        assertEq(mrTcoin.balanceOf(address(swapPool)), 100e6);
        assertEq(cplTcoin.balanceOf(address(swapPool)), 900e6);
    }
}
