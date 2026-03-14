// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockERC20} from "./MockERC20.sol";
import {ISwapAdapter} from "../../../../src/torontocoin/interfaces/ISwapAdapter.sol";

interface ITcoinMintRouterLike {
    function mintTcoinWithToken(
        address tokenIn,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 minTcoinOut,
        uint256 deadline,
        address recipient,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) external returns (uint256 tcoinOut);
}

contract MockSwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;

    uint16 public pullBps = 10_000;
    uint16 public outBps = 10_000;
    uint16 public returnBps = 10_000;

    bool public reenterEnabled;
    bool public reenterFailed;

    address public reenterRouter;
    address public reenterTokenIn;
    address public reenterRecipient;
    uint256 public reenterAmountIn;
    uint256 public reenterDeadline;

    function setPullBps(uint16 pullBps_) external {
        pullBps = pullBps_;
    }

    function setOutBps(uint16 outBps_) external {
        outBps = outBps_;
    }

    function setReturnBps(uint16 returnBps_) external {
        returnBps = returnBps_;
    }

    function setReenterConfig(
        address router,
        address tokenIn,
        address recipient,
        uint256 amountIn,
        uint256 deadline,
        bool enabled
    ) external {
        reenterRouter = router;
        reenterTokenIn = tokenIn;
        reenterRecipient = recipient;
        reenterAmountIn = amountIn;
        reenterDeadline = deadline;
        reenterEnabled = enabled;
        reenterFailed = false;
    }

    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).forceApprove(spender, amount);
    }

    function swapToCadm(
        address tokenIn,
        address cadmToken,
        uint256 amountIn,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (uint256 cadmOut) {
        uint256 pullAmount = (amountIn * pullBps) / 10_000;
        if (pullAmount > 0) {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), pullAmount);
        }

        cadmOut = (amountIn * outBps) / 10_000;
        if (cadmOut > 0) {
            MockERC20(cadmToken).mint(msg.sender, cadmOut);
        }

        if (reenterEnabled) {
            try
                ITcoinMintRouterLike(reenterRouter).mintTcoinWithToken(
                    reenterTokenIn,
                    reenterAmountIn,
                    0,
                    0,
                    reenterDeadline,
                    reenterRecipient,
                    0,
                    ""
                )
            returns (uint256) {
                // No-op, this should fail if router is protected by reentrancy guard.
            } catch {
                reenterFailed = true;
            }
        }

        return (amountIn * returnBps) / 10_000;
    }

    function previewSwapToCadm(
        address,
        address,
        uint256 amountIn,
        bytes calldata
    ) external view override returns (uint256 cadmOut) {
        return (amountIn * outBps) / 10_000;
    }
}
