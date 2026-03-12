// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleRouter {
    function previewCadValue(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 cadValue18, uint256 updatedAt, bool usedFallback);

    function getCadPrice(bytes32 assetId)
        external
        view
        returns (uint256 price18, uint256 updatedAt, bool usedFallback);
}
