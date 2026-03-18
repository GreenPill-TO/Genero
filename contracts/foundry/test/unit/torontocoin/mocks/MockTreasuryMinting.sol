// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockERC20} from "./MockERC20.sol";
import {ITreasuryMinting} from "../../../../src/torontocoin/interfaces/ITreasuryMinting.sol";

contract MockTreasuryMinting is ITreasuryMinting {
    using SafeERC20 for IERC20;

    address public immutable cadm;
    address public override tcoinToken;
    address public immutable override treasury;

    uint16 public mintBps = 10_000;

    constructor(address cadm_, address tcoinToken_) {
        cadm = cadm_;
        tcoinToken = tcoinToken_;
        treasury = address(this);
    }

    function setMintBps(uint16 mintBps_) external {
        mintBps = mintBps_;
    }

    function depositAndMint(bytes32, uint256 assetAmount, uint256, uint256)
        external
        override
        returns (uint256 userTcoinOut, uint256 charityTcoinOut)
    {
        IERC20(cadm).safeTransferFrom(msg.sender, address(this), assetAmount);

        userTcoinOut = (assetAmount * mintBps) / 10_000;
        charityTcoinOut = 0;

        MockERC20(tcoinToken).mint(msg.sender, userTcoinOut);
    }

    function previewMint(bytes32, uint256 assetAmount, uint256)
        external
        view
        override
        returns (
            uint256 userTcoinOut,
            uint256 charityTcoinOut,
            uint256 resolvedCharityId,
            bool usedFallbackOracle,
            uint256 cadValue18
        )
    {
        userTcoinOut = (assetAmount * mintBps) / 10_000;
        charityTcoinOut = 0;
        resolvedCharityId = 0;
        usedFallbackOracle = false;
        cadValue18 = assetAmount;
    }
}
