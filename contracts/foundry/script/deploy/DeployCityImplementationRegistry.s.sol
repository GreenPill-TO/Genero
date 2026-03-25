// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../../src/registry/CityImplementationRegistry.sol";
import "../helpers/DeployChainConfig.sol";

contract DeployCityImplementationRegistry is DeployChainConfig {
    error MissingConfigAddress(string key);

    function run() external returns (address deployedAddress) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        ChainSelection memory selection = _assertDeployTargetChain();
        address initialOwner = _chainConfigAddress(selection, ".registry.initialOwner");
        if (initialOwner == address(0)) revert MissingConfigAddress("registry.initialOwner");

        vm.startBroadcast(privateKey);
        CityImplementationRegistry registry = new CityImplementationRegistry(initialOwner);
        vm.stopBroadcast();

        deployedAddress = address(registry);

        string memory chainDir = string.concat("deployments/registry/", vm.toString(block.chainid));
        vm.createDir(chainDir, true);

        string memory outputPath = string.concat(chainDir, "/registry-deployment.json");
        string memory payload = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "registryAddress": "',
            vm.toString(deployedAddress),
            '",\n',
            '  "initialOwner": "',
            vm.toString(initialOwner),
            '",\n',
            '  "deployedAt": ',
            vm.toString(block.timestamp),
            "\n}"
        );
        vm.writeFile(outputPath, payload);

        console2.log("CityImplementationRegistry deployed at", deployedAddress);
        console2.log("Deployment artifact", outputPath);
        console2.log("Deploy target chain", selection.target);
        console2.log("Expected RPC env", selection.rpcEnvVar);
        console2.log("Explorer API env", selection.explorerApiKeyEnvVar);
    }
}
