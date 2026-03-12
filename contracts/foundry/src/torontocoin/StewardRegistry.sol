// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";

contract StewardRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable, PausableUpgradeable, IStewardRegistry {
    enum StewardStatus {
        None,
        Active,
        Suspended,
        Removed
    }

    struct Steward {
        address stewardAddress;
        string name;
        string metadataRecordId;
        StewardStatus status;
        uint256 assignedCharityCount;
        uint64 createdAt;
        uint64 updatedAt;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressCharityRegistry();
    error ZeroAddressSteward();
    error UnknownSteward(address steward);
    error StewardAlreadyExists(address steward);
    error InvalidStewardStatus(address steward);
    error Unauthorized();
    error CharityAlreadyAssigned(uint256 charityId, address steward);
    error SameAddress();
    error EmptyName();
    error RemovedStewardNotAssignable(address steward);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event CharityRegistryUpdated(address indexed oldCharityRegistry, address indexed newCharityRegistry);

    event StewardRegistered(
        address indexed steward,
        string name,
        string metadataRecordId,
        address indexed actor
    );

    event StewardSuspended(address indexed steward, address indexed actor);
    event StewardUnsuspended(address indexed steward, address indexed actor);
    event StewardRemoved(address indexed steward, address indexed actor);

    event StewardWeightChanged(
        address indexed steward,
        uint256 oldWeight,
        uint256 newWeight
    );

    event CharityAppointmentSynced(
        uint256 indexed charityId,
        address indexed oldSteward,
        address indexed newSteward
    );

    address public governance;
    address public charityRegistry;
    uint256 public totalActiveStewardWeight;

    mapping(address => Steward) private stewards;
    address[] private stewardAddresses;
    mapping(address => bool) private stewardExists;
    mapping(uint256 => address) private assignedStewardByCharity;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier onlyCharityRegistry() {
        if (msg.sender != charityRegistry) revert Unauthorized();
        _;
    }

    function initialize(address owner_, address governance_, address charityRegistry_) external initializer {
        if (owner_ == address(0)) revert ZeroAddressOwner();
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (charityRegistry_ == address(0)) revert ZeroAddressCharityRegistry();

        __Ownable_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        _transferOwnership(owner_);

        governance = governance_;
        charityRegistry = charityRegistry_;

        emit GovernanceUpdated(address(0), governance_);
        emit CharityRegistryUpdated(address(0), charityRegistry_);
    }

    function setGovernance(address governance_) external onlyOwner {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();

        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }

    function setCharityRegistry(address charityRegistry_) external onlyOwner {
        if (charityRegistry_ == address(0)) revert ZeroAddressCharityRegistry();
        if (charityRegistry_ == charityRegistry) revert SameAddress();

        address oldCharityRegistry = charityRegistry;
        charityRegistry = charityRegistry_;
        emit CharityRegistryUpdated(oldCharityRegistry, charityRegistry_);
    }

    function registerSteward(
        address steward,
        string calldata name,
        string calldata metadataRecordId
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (steward == address(0)) revert ZeroAddressSteward();
        if (bytes(name).length == 0) revert EmptyName();
        if (stewardExists[steward]) revert StewardAlreadyExists(steward);

        uint64 ts = uint64(block.timestamp);
        stewards[steward] = Steward({
            stewardAddress: steward,
            name: name,
            metadataRecordId: metadataRecordId,
            status: StewardStatus.Active,
            assignedCharityCount: 0,
            createdAt: ts,
            updatedAt: ts
        });

        stewardExists[steward] = true;
        stewardAddresses.push(steward);

        emit StewardRegistered(steward, name, metadataRecordId, msg.sender);
    }

    function suspendSteward(address steward) external onlyGovernanceOrOwner {
        Steward storage stewardRecord = _getStewardStorage(steward);
        if (stewardRecord.status != StewardStatus.Active) revert InvalidStewardStatus(steward);

        uint256 currentWeight = stewardRecord.assignedCharityCount;
        stewardRecord.status = StewardStatus.Suspended;
        stewardRecord.updatedAt = uint64(block.timestamp);

        if (currentWeight > 0) {
            totalActiveStewardWeight -= currentWeight;
            emit StewardWeightChanged(steward, currentWeight, 0);
        }

        emit StewardSuspended(steward, msg.sender);
    }

    function unsuspendSteward(address steward) external onlyGovernanceOrOwner whenNotPaused {
        Steward storage stewardRecord = _getStewardStorage(steward);
        if (stewardRecord.status != StewardStatus.Suspended) revert InvalidStewardStatus(steward);

        uint256 currentWeight = stewardRecord.assignedCharityCount;
        stewardRecord.status = StewardStatus.Active;
        stewardRecord.updatedAt = uint64(block.timestamp);

        if (currentWeight > 0) {
            totalActiveStewardWeight += currentWeight;
            emit StewardWeightChanged(steward, 0, currentWeight);
        }

        emit StewardUnsuspended(steward, msg.sender);
    }

    function removeSteward(address steward) external onlyGovernanceOrOwner {
        Steward storage stewardRecord = _getStewardStorage(steward);
        if (stewardRecord.status == StewardStatus.Removed) revert InvalidStewardStatus(steward);

        uint256 oldEffectiveWeight = stewardRecord.status == StewardStatus.Active
            ? stewardRecord.assignedCharityCount
            : 0;

        if (oldEffectiveWeight > 0) {
            totalActiveStewardWeight -= oldEffectiveWeight;
            emit StewardWeightChanged(steward, oldEffectiveWeight, 0);
        }

        stewardRecord.status = StewardStatus.Removed;
        stewardRecord.updatedAt = uint64(block.timestamp);

        emit StewardRemoved(steward, msg.sender);
    }

    function syncCharityAppointment(
        uint256 charityId,
        address oldSteward,
        address newSteward
    ) external override onlyCharityRegistry whenNotPaused {
        address mirroredOldSteward = assignedStewardByCharity[charityId];

        if (mirroredOldSteward != oldSteward) {
            oldSteward = mirroredOldSteward;
        }

        if (oldSteward == newSteward) {
            if (newSteward != address(0) && mirroredOldSteward == newSteward) {
                revert CharityAlreadyAssigned(charityId, newSteward);
            }
            return;
        }

        assignedStewardByCharity[charityId] = newSteward;

        if (oldSteward != address(0) && stewardExists[oldSteward]) {
            Steward storage oldStewardRecord = stewards[oldSteward];
            uint256 oldRawWeight = oldStewardRecord.assignedCharityCount;
            if (oldRawWeight > 0) {
                oldStewardRecord.assignedCharityCount = oldRawWeight - 1;
                oldStewardRecord.updatedAt = uint64(block.timestamp);

                if (oldStewardRecord.status == StewardStatus.Active) {
                    totalActiveStewardWeight -= 1;
                    emit StewardWeightChanged(oldSteward, oldRawWeight, oldRawWeight - 1);
                }
            }
        }

        if (newSteward != address(0)) {
            Steward storage newStewardRecord = _getStewardStorage(newSteward);
            if (newStewardRecord.status == StewardStatus.Removed) revert RemovedStewardNotAssignable(newSteward);

            uint256 oldRawWeight = newStewardRecord.assignedCharityCount;
            newStewardRecord.assignedCharityCount = oldRawWeight + 1;
            newStewardRecord.updatedAt = uint64(block.timestamp);

            if (newStewardRecord.status == StewardStatus.Active) {
                totalActiveStewardWeight += 1;
                emit StewardWeightChanged(newSteward, oldRawWeight, oldRawWeight + 1);
            }
        }

        emit CharityAppointmentSynced(charityId, oldSteward, newSteward);
    }

    function getSteward(address steward) external view returns (Steward memory) {
        return _getStewardStorage(steward);
    }

    function isSteward(address steward) external view override returns (bool) {
        if (!stewardExists[steward]) return false;
        return stewards[steward].status == StewardStatus.Active;
    }

    function getStewardWeight(address steward) external view override returns (uint256) {
        if (!stewardExists[steward]) return 0;
        Steward storage stewardRecord = stewards[steward];
        return stewardRecord.status == StewardStatus.Active ? stewardRecord.assignedCharityCount : 0;
    }

    function getAssignedCharityCount(address steward) external view returns (uint256) {
        return _getStewardStorage(steward).assignedCharityCount;
    }

    function getTotalStewardWeight() external view returns (uint256) {
        return totalActiveStewardWeight;
    }

    function getTotalActiveStewardWeight() external view override returns (uint256) {
        return totalActiveStewardWeight;
    }

    function getCharityAssignedSteward(uint256 charityId) external view returns (address) {
        return assignedStewardByCharity[charityId];
    }

    function getStewardCount() external view returns (uint256) {
        return stewardAddresses.length;
    }

    function listStewardAddresses() external view override returns (address[] memory) {
        return stewardAddresses;
    }

    function pause() external onlyGovernanceOrOwner {
        _pause();
    }

    function unpause() external onlyGovernanceOrOwner {
        _unpause();
    }

    function _getStewardStorage(address steward) internal view returns (Steward storage stewardRecord) {
        if (!stewardExists[steward]) revert UnknownSteward(steward);
        stewardRecord = stewards[steward];
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
