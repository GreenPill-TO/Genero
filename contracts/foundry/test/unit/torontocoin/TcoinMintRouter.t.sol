// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TcoinMintRouter} from "../../../src/torontocoin/TcoinMintRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapAdapter} from "./mocks/MockSwapAdapter.sol";
import {MockTreasuryMinting} from "./mocks/MockTreasuryMinting.sol";

contract TcoinMintRouterTest is Test {
    bytes32 private constant CADM_ASSET_ID = bytes32("CADM");

    address private user = address(0xA11CE);
    address private recipient = address(0xBEEF);

    MockERC20 private usdc;
    MockERC20 private cadm;
    MockERC20 private tcoin;
    MockERC20 private dai;

    MockSwapAdapter private swapAdapter;
    MockTreasuryMinting private treasury;
    TcoinMintRouter private router;

    event InputTokenStatusUpdated(address indexed token, bool enabled, address indexed actor);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 18);
        cadm = new MockERC20("CAD Mento", "CADm", 18);
        tcoin = new MockERC20("Toronto Coin", "TCOIN", 18);
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);

        swapAdapter = new MockSwapAdapter();
        treasury = new MockTreasuryMinting(address(cadm), address(tcoin));

        router = new TcoinMintRouter(
            address(this),
            address(swapAdapter),
            address(treasury),
            address(cadm),
            CADM_ASSET_ID,
            address(usdc)
        );

        router.setInputTokenEnabled(address(usdc), true);
        router.setInputTokenEnabled(address(dai), true);

        usdc.mint(user, 1_000e18);
        dai.mint(user, 1_000e18);

        vm.startPrank(user);
        usdc.approve(address(router), type(uint256).max);
        dai.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function test_MintTcoinWithUSDC_HappyPath() public {
        uint256 amountIn = 100e18;

        vm.prank(user);
        uint256 tcoinOut = router.mintTcoinWithUSDC(
            amountIn,
            100e18,
            100e18,
            block.timestamp + 1 hours,
            recipient,
            0,
            ""
        );

        assertEq(tcoinOut, 100e18);
        assertEq(tcoin.balanceOf(recipient), 100e18);
        assertEq(usdc.balanceOf(user), 900e18);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(cadm.balanceOf(address(router)), 0);
        assertEq(tcoin.balanceOf(address(router)), 0);
    }

    function test_MintTcoinWithToken_GenericPath() public {
        uint256 amountIn = 50e18;

        vm.prank(user);
        uint256 tcoinOut = router.mintTcoinWithToken(
            address(dai),
            amountIn,
            50e18,
            50e18,
            block.timestamp + 1 hours,
            recipient,
            0,
            ""
        );

        assertEq(tcoinOut, 50e18);
        assertEq(tcoin.balanceOf(recipient), 50e18);
        assertEq(dai.balanceOf(user), 950e18);
    }

    function test_RevertWhenInputTokenNotEnabled() public {
        MockERC20 unsupported = new MockERC20("Unsupported", "NOPE", 18);
        unsupported.mint(user, 100e18);

        vm.prank(user);
        unsupported.approve(address(router), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(TcoinMintRouter.InputTokenNotEnabled.selector, address(unsupported)));
        vm.prank(user);
        router.mintTcoinWithToken(
            address(unsupported),
            10e18,
            0,
            0,
            block.timestamp + 1 hours,
            recipient,
            0,
            ""
        );
    }

    function test_RevertWhenDeadlineExpired() public {
        vm.expectRevert(TcoinMintRouter.DeadlineExpired.selector);
        vm.prank(user);
        router.mintTcoinWithUSDC(10e18, 0, 0, block.timestamp - 1, recipient, 0, "");
    }

    function test_RevertWhenSwapOutputBelowMinCadmOut() public {
        swapAdapter.setOutBps(8_000);

        vm.expectRevert(
            abi.encodeWithSelector(TcoinMintRouter.SwapReturnedInsufficientCadm.selector, 90e18, 80e18)
        );
        vm.prank(user);
        router.mintTcoinWithUSDC(100e18, 90e18, 0, block.timestamp + 1 hours, recipient, 0, "");
    }

    function test_RevertWhenMintOutputBelowMinTcoinOut() public {
        treasury.setMintBps(8_000);

        vm.expectRevert(
            abi.encodeWithSelector(TcoinMintRouter.TreasuryMintReturnedInsufficientTcoin.selector, 100e18, 80e18)
        );
        vm.prank(user);
        router.mintTcoinWithUSDC(100e18, 100e18, 100e18, block.timestamp + 1 hours, recipient, 0, "");
    }

    function test_RevertOnZeroRecipient() public {
        vm.expectRevert(TcoinMintRouter.RecipientZeroAddress.selector);
        vm.prank(user);
        router.mintTcoinWithUSDC(10e18, 0, 0, block.timestamp + 1 hours, address(0), 0, "");
    }

    function test_RevertOnZeroAmount() public {
        vm.expectRevert(TcoinMintRouter.InvalidAmount.selector);
        vm.prank(user);
        router.mintTcoinWithUSDC(0, 0, 0, block.timestamp + 1 hours, recipient, 0, "");
    }

    function test_RefundsInputTokenLeftovers() public {
        swapAdapter.setPullBps(7_000);
        swapAdapter.setOutBps(7_000);

        vm.prank(user);
        uint256 out = router.mintTcoinWithUSDC(
            100e18,
            70e18,
            70e18,
            block.timestamp + 1 hours,
            recipient,
            0,
            ""
        );

        assertEq(out, 70e18);
        assertEq(tcoin.balanceOf(recipient), 70e18);
        assertEq(usdc.balanceOf(user), 930e18); // 1000 - 70 spent, 30 refunded.
        assertEq(usdc.balanceOf(address(router)), 0);
    }

    function test_PauseBlocksMinting() public {
        router.pause();

        vm.expectRevert("Pausable: paused");
        vm.prank(user);
        router.mintTcoinWithUSDC(10e18, 0, 0, block.timestamp + 1 hours, recipient, 0, "");
    }

    function test_OwnerOnlySettersAndEventEmission() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        router.setSwapAdapter(address(0x1234));

        MockSwapAdapter nextAdapter = new MockSwapAdapter();
        MockTreasuryMinting nextTreasury = new MockTreasuryMinting(address(cadm), address(tcoin));

        router.setSwapAdapter(address(nextAdapter));
        router.setTreasury(address(nextTreasury));

        assertEq(router.swapAdapter(), address(nextAdapter));
        assertEq(router.treasury(), address(nextTreasury));

        vm.expectEmit(true, false, true, true);
        emit InputTokenStatusUpdated(address(usdc), false, address(this));
        router.setInputTokenEnabled(address(usdc), false);

        assertEq(router.enabledInputToken(address(usdc)), false);
    }

    function test_UsesBalanceDeltaOverAdapterReportedValue() public {
        swapAdapter.setOutBps(5_000); // actual CADm minted = 50
        swapAdapter.setReturnBps(20_000); // malicious report = 200

        vm.expectRevert(
            abi.encodeWithSelector(TcoinMintRouter.SwapReturnedInsufficientCadm.selector, 60e18, 50e18)
        );

        vm.prank(user);
        router.mintTcoinWithUSDC(100e18, 60e18, 0, block.timestamp + 1 hours, recipient, 0, "");
    }

    function test_ReentrancyGuardBlocksAdapterCallback() public {
        usdc.mint(address(swapAdapter), 10e18);
        swapAdapter.approveToken(address(usdc), address(router), type(uint256).max);
        swapAdapter.setReenterConfig(
            address(router),
            address(usdc),
            recipient,
            1e18,
            block.timestamp + 1 hours,
            true
        );

        vm.prank(user);
        router.mintTcoinWithUSDC(10e18, 10e18, 10e18, block.timestamp + 1 hours, recipient, 0, "");

        assertTrue(swapAdapter.reenterFailed());
    }

    function test_PreviewMintTcoinWithToken() public {
        (uint256 cadmOut, uint256 tcoinOut) = router.previewMintTcoinWithToken(address(usdc), 25e18, 0, "");

        assertEq(cadmOut, 25e18);
        assertEq(tcoinOut, 25e18);
    }
}
