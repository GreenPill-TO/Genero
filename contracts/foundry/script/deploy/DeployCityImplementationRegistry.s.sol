// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../../src/registry/CityImplementationRegistry.sol";

contract DeployCityImplementationRegistry is Script {
    function run() external returns (address deployedAddress) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address initialOwner = vm.envAddress("INITIAL_OWNER");

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
    }
}
