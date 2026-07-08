// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

contract ReserveRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable, PausableUpgradeable {
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

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressToken();
    error ZeroAssetId();
    error AssetAlreadyExists(bytes32 assetId);
    error TokenAlreadyRegistered(address token);
    error UnknownAsset(bytes32 assetId);
    error UnknownToken(address token);
    error InvalidAssetStatus(bytes32 assetId);
    error InvalidStaleness();
    error ZeroPrimaryOracle();
    error Unauthorized();
    error SameAddress();
    error EmptyCode();

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);

    event ReserveAssetAdded(
        bytes32 indexed assetId,
        address indexed token,
        string code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter
    );

    event ReserveAssetPaused(bytes32 indexed assetId, address indexed actor);
    event ReserveAssetUnpaused(bytes32 indexed assetId, address indexed actor);
    event ReserveAssetRemoved(bytes32 indexed assetId, address indexed actor);

    event ReserveAssetOracleUpdated(
        bytes32 indexed assetId, address indexed primaryOracle, address indexed fallbackOracle
    );

    event ReserveAssetStalenessUpdated(bytes32 indexed assetId, uint256 oldStaleAfter, uint256 newStaleAfter);

    event ReserveAssetCodeUpdated(bytes32 indexed assetId, string oldCode, string newCode);

    address public governance;

    mapping(bytes32 => ReserveAsset) private _reserveAssets;
    mapping(address => bytes32) private _assetIdByToken;
    bytes32[] private _reserveAssetIds;
    mapping(bytes32 => bool) private _assetExists;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    function initialize(address owner_, address governance_) external initializer {
        if (owner_ == address(0)) revert ZeroAddressOwner();
        if (governance_ == address(0)) revert ZeroAddressGovernance();

        __Ownable_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        _transferOwnership(owner_);

        governance = governance_;
        emit GovernanceUpdated(address(0), governance_);
    }

    function setGovernance(address governance_) external onlyOwner {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();

        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }

    function addReserveAsset(
        bytes32 assetId,
        address token,
        string calldata code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (assetId == bytes32(0)) revert ZeroAssetId();
        if (token == address(0)) revert ZeroAddressToken();
        if (bytes(code).length == 0) revert EmptyCode();
        if (primaryOracle == address(0)) revert ZeroPrimaryOracle();
        if (staleAfter == 0) revert InvalidStaleness();
        if (_assetExists[assetId]) revert AssetAlreadyExists(assetId);
        if (_assetIdByToken[token] != bytes32(0)) revert TokenAlreadyRegistered(token);

        _reserveAssets[assetId] = ReserveAsset({
            assetId: assetId,
            token: token,
            code: code,
            tokenDecimals: tokenDecimals,
            primaryOracle: primaryOracle,
            fallbackOracle: fallbackOracle,
            staleAfter: staleAfter,
            status: ReserveAssetStatus.Active
        });

        _assetExists[assetId] = true;
        _assetIdByToken[token] = assetId;
        _reserveAssetIds.push(assetId);

        emit ReserveAssetAdded(assetId, token, code, tokenDecimals, primaryOracle, fallbackOracle, staleAfter);
    }

    function pauseReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status != ReserveAssetStatus.Active) revert InvalidAssetStatus(assetId);

        asset.status = ReserveAssetStatus.Paused;
        emit ReserveAssetPaused(assetId, msg.sender);
    }

    function unpauseReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner whenNotPaused {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status != ReserveAssetStatus.Paused) revert InvalidAssetStatus(assetId);

        asset.status = ReserveAssetStatus.Active;
        emit ReserveAssetUnpaused(assetId, msg.sender);
    }

    function removeReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);

        asset.status = ReserveAssetStatus.Removed;
        emit ReserveAssetRemoved(assetId, msg.sender);
    }

    function updateReserveAssetOracles(bytes32 assetId, address primaryOracle, address fallbackOracle)
        external
        onlyGovernanceOrOwner
        whenNotPaused
    {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);
        if (primaryOracle == address(0)) revert ZeroPrimaryOracle();

        asset.primaryOracle = primaryOracle;
        asset.fallbackOracle = fallbackOracle;

        emit ReserveAssetOracleUpdated(assetId, primaryOracle, fallbackOracle);
    }

    function updateReserveAssetStaleness(bytes32 assetId, uint256 staleAfter)
        external
        onlyGovernanceOrOwner
        whenNotPaused
    {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);
        if (staleAfter == 0) revert InvalidStaleness();

        uint256 oldStaleAfter = asset.staleAfter;
        asset.staleAfter = staleAfter;

        emit ReserveAssetStalenessUpdated(assetId, oldStaleAfter, staleAfter);
    }

    function updateReserveAssetCode(bytes32 assetId, string calldata newCode)
        external
        onlyGovernanceOrOwner
        whenNotPaused
    {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);
        if (bytes(newCode).length == 0) revert EmptyCode();

        string memory oldCode = asset.code;
        asset.code = newCode;

        emit ReserveAssetCodeUpdated(assetId, oldCode, newCode);
    }

    function pause() external onlyGovernanceOrOwner {
        _pause();
    }

    function unpause() external onlyGovernanceOrOwner {
        _unpause();
    }

    function getReserveAsset(bytes32 assetId) external view returns (ReserveAsset memory) {
        return _getReserveAssetStorage(assetId);
    }

    function getReserveAssetByToken(address token) external view returns (ReserveAsset memory) {
        bytes32 assetId = _assetIdByToken[token];
        if (assetId == bytes32(0)) revert UnknownToken(token);
        return _reserveAssets[assetId];
    }

    function getAssetIdByToken(address token) external view returns (bytes32) {
        return _assetIdByToken[token];
    }

    function reserveAssetExists(bytes32 assetId) external view returns (bool) {
        return _assetExists[assetId];
    }

    function isReserveAssetActive(bytes32 assetId) external view returns (bool) {
        if (!_assetExists[assetId]) return false;
        return _reserveAssets[assetId].status == ReserveAssetStatus.Active;
    }

    function listReserveAssetIds() external view returns (bytes32[] memory) {
        return _reserveAssetIds;
    }

    function reserveAssetCount() external view returns (uint256) {
        return _reserveAssetIds.length;
    }

    function getOracleConfig(bytes32 assetId)
        external
        view
        returns (address token, uint8 tokenDecimals, address primaryOracle, address fallbackOracle, uint256 staleAfter)
    {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        return (asset.token, asset.tokenDecimals, asset.primaryOracle, asset.fallbackOracle, asset.staleAfter);
    }

    function _getReserveAssetStorage(bytes32 assetId) internal view returns (ReserveAsset storage asset) {
        if (!_assetExists[assetId]) revert UnknownAsset(assetId);
        asset = _reserveAssets[assetId];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
