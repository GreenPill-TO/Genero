// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

abstract contract DeployChainConfig is Script {
    struct ChainSelection {
        string target;
        uint256 chainId;
        string rpcEnvVar;
        string explorerApiKeyEnvVar;
    }

    error UnsupportedDeployTargetChain(string target);
    error DeployTargetChainMismatch(string target, uint256 expectedChainId, uint256 actualChainId);

    function _resolveDeployChain() internal view returns (ChainSelection memory selection) {
        string memory target = vm.envOr("DEPLOY_TARGET_CHAIN", string("celo"));

        if (_sameString(target, "celo")) {
            return ChainSelection({
                target: "celo", chainId: 42220, rpcEnvVar: "MAINNET_RPC_URL", explorerApiKeyEnvVar: "CELOSCAN_API_KEY"
            });
        }

        if (_sameString(target, "sepolia")) {
            return ChainSelection({
                target: "sepolia",
                chainId: 11155111,
                rpcEnvVar: "SEPOLIA_RPC_URL",
                explorerApiKeyEnvVar: "ETHERSCAN_API_KEY"
            });
        }

        revert UnsupportedDeployTargetChain(target);
    }

    function _assertDeployTargetChain() internal view returns (ChainSelection memory selection) {
        selection = _resolveDeployChain();
        if (block.chainid != selection.chainId) {
            revert DeployTargetChainMismatch(selection.target, selection.chainId, block.chainid);
        }
    }

    function _sameString(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
