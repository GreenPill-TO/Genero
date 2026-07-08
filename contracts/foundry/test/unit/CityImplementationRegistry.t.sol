// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/registry/CityImplementationRegistry.sol";

contract CityImplementationRegistryTest is Test {
    CityImplementationRegistry private registry;
    bytes32 private cityId;
    address private nonOwner = makeAddr("nonOwner");

    event VersionRegistered(
        bytes32 indexed cityId,
        uint64 indexed version,
        uint256 chainId,
        CityImplementationRegistry.ContractSet contracts,
        string metadataURI,
        address indexed actor
    );

    event VersionPromoted(bytes32 indexed cityId, uint64 indexed version, uint256 chainId, address indexed actor);

    function setUp() public {
        registry = new CityImplementationRegistry(address(this));
        cityId = keccak256(bytes("tcoin"));
    }

    function test_registersFirstVersion() public {
        uint64 version = registry.registerVersion(cityId, 545, _contractSet(), "ipfs://tcoin-v1");
        assertEq(version, 1);
        assertEq(registry.latestVersionByCity(cityId), 1);
        assertEq(registry.currentVersionByCity(cityId), 0);

        CityImplementationRegistry.VersionRecord memory record = registry.getVersion(cityId, 1);
        assertEq(record.version, 1);
        assertEq(record.chainId, 545);
        assertEq(record.contracts.tcoin, _contractSet().tcoin);
        assertEq(record.metadataURI, "ipfs://tcoin-v1");
        assertTrue(record.exists);
    }

    function test_rejectsZeroContractAddress() public {
        CityImplementationRegistry.ContractSet memory contracts = _contractSet();
        contracts.tcoin = address(0);

        vm.expectRevert(
            abi.encodeWithSelector(CityImplementationRegistry.InvalidContractAddress.selector, bytes32("TCOIN"))
        );
        registry.registerVersion(cityId, 545, contracts, "ipfs://invalid");
    }

    function test_promotesRegisteredVersion() public {
        uint64 version = registry.registerVersion(cityId, 545, _contractSet(), "ipfs://v1");
        vm.expectEmit(true, true, false, true, address(registry));
        emit VersionPromoted(cityId, version, 545, address(this));

        registry.promoteVersion(cityId, version);

        assertEq(registry.currentVersionByCity(cityId), version);
        CityImplementationRegistry.VersionRecord memory active = registry.getActiveContracts(cityId);
        assertEq(active.version, version);
        assertEq(active.chainId, 545);
        assertTrue(active.promotedAt > 0);
    }

    function test_promotesOlderVersionForRollback() public {
        uint64 v1 = registry.registerVersion(cityId, 545, _contractSet(), "ipfs://v1");
        CityImplementationRegistry.ContractSet memory v2Contracts = _contractSet();
        v2Contracts.tcoin = makeAddr("tcoin-v2");
        uint64 v2 = registry.registerVersion(cityId, 545, v2Contracts, "ipfs://v2");

        registry.promoteVersion(cityId, v2);
        assertEq(registry.currentVersionByCity(cityId), v2);

        registry.promoteVersion(cityId, v1);
        assertEq(registry.currentVersionByCity(cityId), v1);
        CityImplementationRegistry.VersionRecord memory active = registry.getActiveContracts(cityId);
        assertEq(active.version, v1);
        assertEq(active.contracts.tcoin, _contractSet().tcoin);
    }

    function test_onlyOwnerCanRegisterAndPromote() public {
        vm.startPrank(nonOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.registerVersion(cityId, 545, _contractSet(), "ipfs://x");

        vm.expectRevert("Ownable: caller is not the owner");
        registry.promoteVersion(cityId, 1);
        vm.stopPrank();
    }

    function test_emitsVersionRegisteredEvent() public {
        CityImplementationRegistry.ContractSet memory contracts = _contractSet();
        vm.expectEmit(true, true, false, true, address(registry));
        emit VersionRegistered(cityId, 1, 545, contracts, "ipfs://v1", address(this));

        registry.registerVersion(cityId, 545, contracts, "ipfs://v1");
    }

    function _contractSet() private returns (CityImplementationRegistry.ContractSet memory) {
        return CityImplementationRegistry.ContractSet({
            tcoin: makeAddr("tcoin"),
            ttc: makeAddr("ttc"),
            cad: makeAddr("cad"),
            orchestrator: makeAddr("orchestrator"),
            oracleRouter: makeAddr("oracle-router"),
            voting: makeAddr("voting")
        });
    }
}
