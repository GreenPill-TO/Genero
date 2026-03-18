// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Treasury} from "../../../src/torontocoin/Treasury.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract TreasuryTest is Test {
    Treasury private treasury;
    MockERC20 private reserveToken;

    address private caller = address(0x1234);
    address private depositor = address(0x5678);
    address private recipient = address(0x9ABC);

    function setUp() public {
        treasury = new Treasury(address(this));
        reserveToken = new MockERC20("USD Coin", "USDC", 18);
        treasury.setAuthorizedCaller(caller, true);
    }

    function test_AuthorizedCallerCanDepositAndWithdraw() public {
        reserveToken.mint(depositor, 100e18);

        vm.prank(depositor);
        reserveToken.approve(address(treasury), type(uint256).max);

        vm.prank(caller);
        treasury.depositReserveFrom(depositor, address(reserveToken), 100e18);

        vm.prank(caller);
        treasury.withdrawReserveTo(recipient, address(reserveToken), 40e18);

        assertEq(treasury.reserveBalance(address(reserveToken)), 60e18);
        assertEq(reserveToken.balanceOf(recipient), 40e18);
    }

    function test_EmergencySweepIsOwnerOnly() public {
        reserveToken.mint(address(treasury), 25e18);

        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(caller);
        treasury.emergencySweep(address(reserveToken), recipient, 5e18);

        treasury.emergencySweep(address(reserveToken), recipient, 5e18);

        assertEq(reserveToken.balanceOf(recipient), 5e18);
        assertEq(treasury.reserveBalance(address(reserveToken)), 20e18);
    }
}
