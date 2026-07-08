// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {DirectOnlySwapAdapter} from "../../../src/torontocoin/DirectOnlySwapAdapter.sol";

contract DirectOnlySwapAdapterTest is Test {
    DirectOnlySwapAdapter private adapter;

    function setUp() public {
        adapter = new DirectOnlySwapAdapter();
    }

    function test_PreviewRevertsWhenSwapPathIsDisabled() public {
        vm.expectRevert(
            abi.encodeWithSelector(DirectOnlySwapAdapter.SwapsDisabled.selector, address(0x1234), address(0x5678))
        );
        adapter.previewSwapToCadm(address(0x1234), address(0x5678), 1 ether, "");
    }

    function test_SwapRevertsWhenSwapPathIsDisabled() public {
        vm.expectRevert(
            abi.encodeWithSelector(DirectOnlySwapAdapter.SwapsDisabled.selector, address(0x1234), address(0x5678))
        );
        adapter.swapToCadm(address(0x1234), address(0x5678), 1 ether, 1, block.timestamp, "");
    }
}
