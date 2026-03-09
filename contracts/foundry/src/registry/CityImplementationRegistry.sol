// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CityImplementationRegistry is Ownable {
    struct ContractSet {
        address tcoin;
        address ttc;
        address cad;
        address orchestrator;
        address voting;
    }

    struct VersionRecord {
        uint64 version;
        uint64 createdAt;
        uint64 promotedAt;
        uint256 chainId;
        ContractSet contracts;
        string metadataURI;
        bool exists;
    }

    mapping(bytes32 => uint64) public currentVersionByCity;
    mapping(bytes32 => uint64) public latestVersionByCity;
    mapping(bytes32 => mapping(uint64 => VersionRecord)) internal versions;

    error InvalidChainId();
    error InvalidContractAddress(bytes32 contractKey);
    error UnknownVersion(bytes32 cityId, uint64 version);
    error NoActiveVersion(bytes32 cityId);

    event VersionRegistered(
        bytes32 indexed cityId,
        uint64 indexed version,
        uint256 chainId,
        ContractSet contracts,
        string metadataURI,
        address indexed actor
    );
    event VersionPromoted(bytes32 indexed cityId, uint64 indexed version, uint256 chainId, address indexed actor);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "initialOwner required");
        transferOwnership(initialOwner);
    }

    function registerVersion(
        bytes32 cityId,
        uint256 chainId,
        ContractSet calldata contracts,
        string calldata metadataURI
    ) external onlyOwner returns (uint64 version) {
        return _registerVersion(cityId, chainId, contracts, metadataURI);
    }

    function promoteVersion(bytes32 cityId, uint64 version) external onlyOwner {
        _promoteVersion(cityId, version);
    }

    function registerAndPromote(
        bytes32 cityId,
        uint256 chainId,
        ContractSet calldata contracts,
        string calldata metadataURI
    ) external onlyOwner returns (uint64 version) {
        version = _registerVersion(cityId, chainId, contracts, metadataURI);
        _promoteVersion(cityId, version);
    }

    function getCurrentVersion(bytes32 cityId) external view returns (uint64) {
        return currentVersionByCity[cityId];
    }

    function getVersion(bytes32 cityId, uint64 version) external view returns (VersionRecord memory) {
        return versions[cityId][version];
    }

    function getActiveContracts(bytes32 cityId) external view returns (VersionRecord memory) {
        uint64 currentVersion = currentVersionByCity[cityId];
        if (currentVersion == 0) revert NoActiveVersion(cityId);

        return versions[cityId][currentVersion];
    }

    function _registerVersion(
        bytes32 cityId,
        uint256 chainId,
        ContractSet calldata contracts,
        string calldata metadataURI
    ) internal returns (uint64 version) {
        if (chainId == 0) revert InvalidChainId();
        _validateContractSet(contracts);

        version = latestVersionByCity[cityId] + 1;
        latestVersionByCity[cityId] = version;

        versions[cityId][version] = VersionRecord({
            version: version,
            createdAt: uint64(block.timestamp),
            promotedAt: 0,
            chainId: chainId,
            contracts: contracts,
            metadataURI: metadataURI,
            exists: true
        });

        emit VersionRegistered(cityId, version, chainId, contracts, metadataURI, msg.sender);
    }

    function _promoteVersion(bytes32 cityId, uint64 version) internal {
        VersionRecord storage record = versions[cityId][version];
        if (!record.exists) revert UnknownVersion(cityId, version);

        currentVersionByCity[cityId] = version;
        record.promotedAt = uint64(block.timestamp);

        emit VersionPromoted(cityId, version, record.chainId, msg.sender);
    }

    function _validateContractSet(ContractSet calldata contracts) internal pure {
        if (contracts.tcoin == address(0)) revert InvalidContractAddress("TCOIN");
        if (contracts.ttc == address(0)) revert InvalidContractAddress("TTC");
        if (contracts.cad == address(0)) revert InvalidContractAddress("CAD");
        if (contracts.orchestrator == address(0)) revert InvalidContractAddress("ORCHESTRATOR");
        if (contracts.voting == address(0)) revert InvalidContractAddress("VOTING");
    }
}
