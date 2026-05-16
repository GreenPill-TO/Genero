// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Simple fixed-price CAD oracle for reserve assets designed to stay at the CAD peg.
/// @dev Exposes the minimal interface consumed by OracleRouter.
contract StaticCadOracle {
    uint8 private immutable DECIMALS_;
    int256 private immutable LATEST_ANSWER_;

    constructor(uint8 decimals_, int256 latestAnswer_) {
        DECIMALS_ = decimals_;
        LATEST_ANSWER_ = latestAnswer_;
    }

    function decimals() external view returns (uint8) {
        return DECIMALS_;
    }

    function latestAnswer() external view returns (int256) {
        return LATEST_ANSWER_;
    }

    function latestTimestamp() external view returns (uint256) {
        return block.timestamp;
    }
}
