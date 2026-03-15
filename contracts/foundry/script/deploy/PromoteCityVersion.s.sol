// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import "../../src/registry/CityImplementationRegistry.sol";

contract PromoteCityVersion is Script {
    using stdJson for string;

    error InvalidCitySlug();
    error InvalidChainId();
    error InvalidContractAddress(string key);

    struct DeploymentInput {
        string citySlug;
        uint256 chainId;
        CityImplementationRegistry.ContractSet contracts;
        string metadataURI;
    }

    function run() external returns (uint64 promotedVersion) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        string memory deploymentFile = vm.envString("DEPLOYMENT_FILE");

        string memory json = vm.readFile(deploymentFile);
        DeploymentInput memory input = _parseAndValidate(json);
        bytes32 cityId = _cityId(input.citySlug);

        vm.startBroadcast(privateKey);
        promotedVersion = CityImplementationRegistry(registryAddress).registerAndPromote(
            cityId, input.chainId, input.contracts, input.metadataURI
        );
        vm.stopBroadcast();

        string memory promotionsDir =
            string.concat("deployments/registry/", vm.toString(input.chainId), "/promotions");
        vm.createDir(promotionsDir, true);

        string memory outputPath = string.concat(promotionsDir, "/", vm.toString(block.timestamp), ".json");
        string memory payload = "{\n";
        payload = string.concat(payload, '  "citySlug": "', _toLower(input.citySlug), '",\n');
        payload = string.concat(payload, '  "cityId": "', vm.toString(cityId), '",\n');
        payload = string.concat(payload, '  "chainId": ', vm.toString(input.chainId), ",\n");
        payload = string.concat(payload, '  "registryAddress": "', vm.toString(registryAddress), '",\n');
        payload = string.concat(payload, '  "version": ', vm.toString(promotedVersion), ",\n");
        payload = string.concat(payload, '  "metadataURI": "', input.metadataURI, '",\n');
        payload = string.concat(payload, '  "contracts": {\n');
        payload = string.concat(payload, '    "TCOIN": "', vm.toString(input.contracts.tcoin), '",\n');
        payload = string.concat(payload, '    "TTC": "', vm.toString(input.contracts.ttc), '",\n');
        payload = string.concat(payload, '    "CAD": "', vm.toString(input.contracts.cad), '",\n');
        payload = string.concat(payload, '    "ORCHESTRATOR": "', vm.toString(input.contracts.orchestrator), '",\n');
        payload = string.concat(payload, '    "ORACLE_ROUTER": "', vm.toString(input.contracts.oracleRouter), '",\n');
        payload = string.concat(payload, '    "VOTING": "', vm.toString(input.contracts.voting), '"\n');
        payload = string.concat(payload, "  },\n");
        payload = string.concat(payload, '  "promotedAt": ', vm.toString(block.timestamp), "\n}");
        vm.writeFile(outputPath, payload);

        console2.log("Promoted city version");
        console2.log("  citySlug:", input.citySlug);
        console2.logBytes32(cityId);
        console2.log("  chainId:", input.chainId);
        console2.log("  version:", promotedVersion);
        console2.log("  artifact:", outputPath);
    }

    function _parseAndValidate(string memory json) internal returns (DeploymentInput memory input) {
        input.citySlug = json.readString(".citySlug");
        if (bytes(input.citySlug).length == 0) revert InvalidCitySlug();

        input.chainId = json.readUint(".chainId");
        if (input.chainId == 0) revert InvalidChainId();

        input.contracts = CityImplementationRegistry.ContractSet({
            tcoin: json.readAddress(".contracts.TCOIN"),
            ttc: json.readAddress(".contracts.TTC"),
            cad: json.readAddress(".contracts.CAD"),
            orchestrator: json.readAddress(".contracts.ORCHESTRATOR"),
            oracleRouter: json.readAddress(".contracts.ORACLE_ROUTER"),
            voting: json.readAddress(".contracts.VOTING")
        });

        if (input.contracts.tcoin == address(0)) revert InvalidContractAddress("TCOIN");
        if (input.contracts.ttc == address(0)) revert InvalidContractAddress("TTC");
        if (input.contracts.cad == address(0)) revert InvalidContractAddress("CAD");
        if (input.contracts.orchestrator == address(0)) revert InvalidContractAddress("ORCHESTRATOR");
        if (input.contracts.oracleRouter == address(0)) revert InvalidContractAddress("ORACLE_ROUTER");
        if (input.contracts.voting == address(0)) revert InvalidContractAddress("VOTING");

        input.metadataURI = json.readString(".metadataURI");
    }

    function _cityId(string memory citySlug) internal pure returns (bytes32) {
        return keccak256(bytes(_toLower(citySlug)));
    }

    function _toLower(string memory value) internal pure returns (string memory) {
        bytes memory source = bytes(value);
        bytes memory output = new bytes(source.length);
        for (uint256 i = 0; i < source.length; i++) {
            bytes1 b = source[i];
            if (b >= 0x41 && b <= 0x5A) {
                output[i] = bytes1(uint8(b) + 32);
            } else {
                output[i] = b;
            }
        }
        return string(output);
    }
}
