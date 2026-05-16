// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

contract DirectOnlySwapAdapter is ISwapAdapter {
    error SwapsDisabled(address tokenIn, address cadmToken);

    function swapToCadm(address tokenIn, address cadmToken, uint256, uint256, uint256, bytes calldata)
        external
        pure
        returns (uint256)
    {
        revert SwapsDisabled(tokenIn, cadmToken);
    }

    function previewSwapToCadm(address tokenIn, address cadmToken, uint256, bytes calldata)
        external
        pure
        returns (uint256)
    {
        revert SwapsDisabled(tokenIn, cadmToken);
    }
}
