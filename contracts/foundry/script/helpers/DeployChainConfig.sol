// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";

abstract contract DeployChainConfig is Script {
    using stdJson for string;

    string internal constant _DEPLOY_CONFIG_PATH = "deploy-config.json";

    struct ChainSelection {
        string target;
        uint256 chainId;
        string rpcEnvVar;
        string explorerApiKeyEnvVar;
    }

    error UnsupportedDeployTargetChain(string target);
    error DeployTargetChainMismatch(string target, uint256 expectedChainId, uint256 actualChainId);

    function _resolveDeployChain() internal view returns (ChainSelection memory selection) {
        string memory json = _deployConfig();
        string memory target =
            _envStringOr(_deployConfig().readString(".defaultDeployTargetChain"), "DEPLOY_TARGET_CHAIN");
        string memory root = string.concat(".chains.", target);

        try vm.parseJsonUint(json, string.concat(root, ".chainId")) returns (uint256 chainId) {
            return ChainSelection({
                target: target,
                chainId: chainId,
                rpcEnvVar: json.readString(string.concat(root, ".rpcEnvVar")),
                explorerApiKeyEnvVar: json.readString(string.concat(root, ".explorerApiKeyEnvVar"))
            });
        } catch {
            revert UnsupportedDeployTargetChain(target);
        }
    }

    function _assertDeployTargetChain() internal view returns (ChainSelection memory selection) {
        selection = _resolveDeployChain();
        if (block.chainid != selection.chainId) {
            revert DeployTargetChainMismatch(selection.target, selection.chainId, block.chainid);
        }
    }

    function _chainConfigAddress(ChainSelection memory selection, string memory suffix)
        internal
        view
        returns (address)
    {
        return _deployConfig().readAddress(string.concat(_chainRoot(selection), suffix));
    }

    function _chainConfigString(ChainSelection memory selection, string memory suffix)
        internal
        view
        returns (string memory)
    {
        return _deployConfig().readString(string.concat(_chainRoot(selection), suffix));
    }

    function _chainConfigBytes32(ChainSelection memory selection, string memory suffix)
        internal
        view
        returns (bytes32)
    {
        return _deployConfig().readBytes32(string.concat(_chainRoot(selection), suffix));
    }

    function _chainConfigUint(ChainSelection memory selection, string memory suffix) internal view returns (uint256) {
        return _deployConfig().readUint(string.concat(_chainRoot(selection), suffix));
    }

    function _chainConfigBool(ChainSelection memory selection, string memory suffix) internal view returns (bool) {
        return _deployConfig().readBool(string.concat(_chainRoot(selection), suffix));
    }

    function _chainConfigAddressOrDefault(ChainSelection memory selection, string memory suffix, address defaultValue)
        internal
        view
        returns (address)
    {
        string memory path = string.concat(_chainRoot(selection), suffix);
        try vm.parseJsonAddress(_deployConfig(), path) returns (address configured) {
            return configured == address(0) ? defaultValue : configured;
        } catch {
            return defaultValue;
        }
    }

    function _chainConfigStringOr(ChainSelection memory selection, string memory suffix, string memory defaultValue)
        internal
        view
        returns (string memory)
    {
        string memory path = string.concat(_chainRoot(selection), suffix);
        try vm.parseJsonString(_deployConfig(), path) returns (string memory configured) {
            return configured;
        } catch {
            return defaultValue;
        }
    }

    function _chainRoot(ChainSelection memory selection) internal pure returns (string memory) {
        return string.concat(".chains.", selection.target);
    }

    function _deployConfig() internal view returns (string memory) {
        return vm.readFile(_DEPLOY_CONFIG_PATH);
    }

    function _envStringOr(string memory fallbackValue, string memory name) internal view returns (string memory value) {
        try vm.envString(name) returns (string memory parsed) {
            return parsed;
        } catch {
            return fallbackValue;
        }
    }

    function _sameString(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
