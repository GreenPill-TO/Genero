// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReserveRegistry {
    enum ReserveAssetStatus {
        None,
        Active,
        Paused,
        Removed
    }

    struct ReserveAsset {
        bytes32 assetId;
        address token;
        string code;
        uint8 tokenDecimals;
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
        ReserveAssetStatus status;
    }

    function addReserveAsset(
        bytes32 assetId,
        address token,
        string calldata code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter
    ) external;

    function removeReserveAsset(bytes32 assetId) external;
    function pauseReserveAsset(bytes32 assetId) external;
    function unpauseReserveAsset(bytes32 assetId) external;

    function updateReserveAssetOracles(bytes32 assetId, address primaryOracle, address fallbackOracle) external;

    function updateReserveAssetStaleness(bytes32 assetId, uint256 staleAfter) external;

    function getReserveAsset(bytes32 assetId) external view returns (ReserveAsset memory);
    function isReserveAssetActive(bytes32 assetId) external view returns (bool);
    function listReserveAssetIds() external view returns (bytes32[] memory);

    function getOracleConfig(bytes32 assetId)
        external
        view
        returns (address token, uint8 tokenDecimals, address primaryOracle, address fallbackOracle, uint256 staleAfter);
}
