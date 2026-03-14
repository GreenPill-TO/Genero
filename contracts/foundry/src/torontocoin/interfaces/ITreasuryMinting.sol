// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryMinting {
    function depositAndMint(
        bytes32 assetId,
        uint256 assetAmount,
        uint256 requestedCharityId,
        uint256 minTcoinOut
    ) external returns (uint256 userTcoinOut, uint256 charityTcoinOut);

    function previewMint(
        bytes32 assetId,
        uint256 assetAmount,
        uint256 requestedCharityId
    )
        external
        view
        returns (
            uint256 userTcoinOut,
            uint256 charityTcoinOut,
            uint256 resolvedCharityId,
            bool usedFallbackOracle,
            uint256 cadValue18
        );

    function tcoinToken() external view returns (address);
}
