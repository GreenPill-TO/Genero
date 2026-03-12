// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReserveRegistry} from "./interfaces/IReserveRegistry.sol";

interface ICadOracle {
    function latestAnswer() external view returns (int256);
    function latestTimestamp() external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract OracleRouter is Ownable {
    uint8 public constant NORMALIZED_PRICE_DECIMALS = 18;

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressReserveRegistry();
    error UnknownAsset(bytes32 assetId);
    error NoFreshOraclePrice(bytes32 assetId);
    error InvalidAssetAmount();
    error InvalidOracleDecimals(bytes32 assetId, address oracle, uint8 decimals);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event ReserveRegistryUpdated(address indexed oldReserveRegistry, address indexed newReserveRegistry);

    address public governance;
    address public reserveRegistry;

    struct OracleStatus {
        bool ok;
        uint256 price18;
        uint256 updatedAt;
    }

    constructor(address initialOwner, address governance_, address reserveRegistry_) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
        _setGovernance(governance_);
        _setReserveRegistry(reserveRegistry_);
    }

    function setGovernance(address governance_) external onlyOwner {
        _setGovernance(governance_);
    }

    function setReserveRegistry(address reserveRegistry_) external onlyOwner {
        _setReserveRegistry(reserveRegistry_);
    }

    function getCadPrice(bytes32 assetId)
        external
        view
        returns (uint256 price18, uint256 updatedAt, bool usedFallback)
    {
        return _getCadPrice(assetId);
    }

    function previewCadValue(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 cadValue18, uint256 updatedAt, bool usedFallback)
    {
        if (assetAmount == 0) revert InvalidAssetAmount();

        (, uint8 tokenDecimals, , , ) = _getOracleConfig(assetId);

        uint256 price18;
        (price18, updatedAt, usedFallback) = _getCadPrice(assetId);

        cadValue18 = (assetAmount * price18) / (10 ** tokenDecimals);
    }

    function isPriceFresh(bytes32 assetId) external view returns (bool fresh, bool wouldUseFallback) {
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
        (, , primaryOracle, fallbackOracle, staleAfter) = _getOracleConfig(assetId);

        OracleStatus memory primary = _readAndValidateOracle(assetId, primaryOracle, staleAfter);
        if (primary.ok) {
            return (true, false);
        }

        OracleStatus memory fallbackStatus = _readAndValidateOracle(assetId, fallbackOracle, staleAfter);
        if (fallbackStatus.ok) {
            return (true, true);
        }

        return (false, false);
    }

    function getOracleStatus(bytes32 assetId)
        external
        view
        returns (
            address primaryOracle,
            address fallbackOracle,
            bool primaryUsable,
            bool fallbackUsable,
            uint256 primaryUpdatedAt,
            uint256 fallbackUpdatedAt
        )
    {
        uint256 staleAfter;
        (, , primaryOracle, fallbackOracle, staleAfter) = _getOracleConfig(assetId);

        OracleStatus memory primary = _readAndValidateOracle(assetId, primaryOracle, staleAfter);
        OracleStatus memory fallbackStatus = _readAndValidateOracle(assetId, fallbackOracle, staleAfter);

        primaryUsable = primary.ok;
        fallbackUsable = fallbackStatus.ok;
        primaryUpdatedAt = primary.updatedAt;
        fallbackUpdatedAt = fallbackStatus.updatedAt;
    }

    function _getCadPrice(bytes32 assetId)
        internal
        view
        returns (uint256 price18, uint256 updatedAt, bool usedFallback)
    {
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
        (, , primaryOracle, fallbackOracle, staleAfter) = _getOracleConfig(assetId);

        if (primaryOracle == address(0) && fallbackOracle == address(0)) {
            revert NoFreshOraclePrice(assetId);
        }

        OracleStatus memory primary = _readAndValidateOracle(assetId, primaryOracle, staleAfter);
        if (primary.ok) {
            return (primary.price18, primary.updatedAt, false);
        }

        OracleStatus memory fallbackStatus = _readAndValidateOracle(assetId, fallbackOracle, staleAfter);
        if (fallbackStatus.ok) {
            return (fallbackStatus.price18, fallbackStatus.updatedAt, true);
        }

        revert NoFreshOraclePrice(assetId);
    }

    function _getOracleConfig(bytes32 assetId)
        internal
        view
        returns (
            address token,
            uint8 tokenDecimals,
            address primaryOracle,
            address fallbackOracle,
            uint256 staleAfter
        )
    {
        if (assetId == bytes32(0)) revert UnknownAsset(assetId);

        (token, tokenDecimals, primaryOracle, fallbackOracle, staleAfter) =
            IReserveRegistry(reserveRegistry).getOracleConfig(assetId);

        if (token == address(0)) revert UnknownAsset(assetId);
        if (staleAfter == 0) revert UnknownAsset(assetId);
    }

    function _readAndValidateOracle(
        bytes32 assetId,
        address oracle,
        uint256 staleAfter
    ) internal view returns (OracleStatus memory status) {
        if (oracle == address(0)) {
            return status;
        }

        try ICadOracle(oracle).latestAnswer() returns (int256 answer) {
            if (answer <= 0) {
                return status;
            }

            uint256 updatedAt;
            try ICadOracle(oracle).latestTimestamp() returns (uint256 ts) {
                updatedAt = ts;
            } catch {
                return status;
            }

            if (updatedAt == 0 || block.timestamp - updatedAt > staleAfter) {
                return status;
            }

            uint8 oracleDecimals;
            try ICadOracle(oracle).decimals() returns (uint8 dec) {
                oracleDecimals = dec;
            } catch {
                return status;
            }

            uint256 normalized = _normalizeOraclePrice(assetId, oracle, uint256(answer), oracleDecimals);

            status.ok = true;
            status.price18 = normalized;
            status.updatedAt = updatedAt;
            return status;
        } catch {
            return status;
        }
    }

    function _normalizeOraclePrice(
        bytes32 assetId,
        address oracle,
        uint256 rawPrice,
        uint8 oracleDecimals
    ) internal pure returns (uint256 price18) {
        if (oracleDecimals == NORMALIZED_PRICE_DECIMALS) {
            return rawPrice;
        }

        if (oracleDecimals < NORMALIZED_PRICE_DECIMALS) {
            return rawPrice * (10 ** (NORMALIZED_PRICE_DECIMALS - oracleDecimals));
        }

        if (oracleDecimals > 77) {
            revert InvalidOracleDecimals(assetId, oracle, oracleDecimals);
        }

        return rawPrice / (10 ** (oracleDecimals - NORMALIZED_PRICE_DECIMALS));
    }

    function _setGovernance(address governance_) internal {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }

    function _setReserveRegistry(address reserveRegistry_) internal {
        if (reserveRegistry_ == address(0)) revert ZeroAddressReserveRegistry();
        address oldReserveRegistry = reserveRegistry;
        reserveRegistry = reserveRegistry_;
        emit ReserveRegistryUpdated(oldReserveRegistry, reserveRegistry_);
    }
}
