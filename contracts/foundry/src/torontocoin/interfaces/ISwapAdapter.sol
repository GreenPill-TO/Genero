// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISwapAdapter {
    function swapToCadm(
        address tokenIn,
        address cadmToken,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 deadline,
        bytes calldata swapData
    ) external returns (uint256 cadmOut);

    function previewSwapToCadm(
        address tokenIn,
        address cadmToken,
        uint256 amountIn,
        bytes calldata swapData
    ) external view returns (uint256 cadmOut);
}
