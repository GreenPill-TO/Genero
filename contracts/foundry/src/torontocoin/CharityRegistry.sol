// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ICharityRegistry} from "./interfaces/ICharityRegistry.sol";
import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";

contract CharityRegistry is Ownable, ReentrancyGuard, ICharityRegistry {
    enum CharityStatus {
        None,
        Active,
        Suspended,
        Removed
    }

    struct Charity {
        uint256 charityId;
        string name;
        address wallet;
        string metadataRecordId;
        CharityStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressTarget();
    error EmptyString();
    error UnknownCharity(uint256 charityId);
    error CharityNotActive(uint256 charityId);
    error CharityNotSuspended(uint256 charityId);
    error CharityAlreadyRemoved(uint256 charityId);
    error CharityAlreadyExistsByWallet(address wallet);
    error GovernanceOnly(address caller);
    error StewardRegistryOnly(address caller);
    error InvalidDefaultCharity(uint256 charityId);
    error SameAddress();

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event StewardRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    event CharityAdded(
        uint256 indexed charityId,
        string name,
        address indexed wallet,
        string metadataRecordId
    );
    event CharityUpdated(
        uint256 indexed charityId,
        string name,
        address indexed wallet,
        string metadataRecordId
    );
    event CharitySuspended(uint256 indexed charityId);
    event CharityUnsuspended(uint256 indexed charityId);
    event CharityRemoved(uint256 indexed charityId);
    event DefaultCharityUpdated(uint256 indexed oldDefaultCharityId, uint256 indexed newDefaultCharityId);
    event StewardAssigned(uint256 indexed charityId, address indexed steward);
    event StewardCleared(uint256 indexed charityId);

    address public governance;
    address public stewardRegistry;

    uint256 public charityCount;
    uint256 public activeCharityCount;
    uint256 public defaultCharityId;

    mapping(uint256 => Charity) private _charities;
    mapping(address => uint256) public charityIdByWallet;
    mapping(uint256 => address) public assignedStewardByCharityId;

    constructor(address initialOwner, address governance_, address stewardRegistry_) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
        _setGovernance(governance_);
        _setStewardRegistry(stewardRegistry_);
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert GovernanceOnly(msg.sender);
        _;
    }

    modifier onlyStewardRegistry() {
        if (msg.sender != stewardRegistry) revert StewardRegistryOnly(msg.sender);
        _;
    }

    function setGovernance(address newGovernance) external onlyOwner {
        _setGovernance(newGovernance);
    }

    function setStewardRegistry(address newRegistry) external onlyOwner {
        _setStewardRegistry(newRegistry);
    }

    function addCharity(
        string calldata name,
        address wallet,
        string calldata metadataRecordId
    ) external onlyGovernance nonReentrant returns (uint256 charityId) {
        if (bytes(name).length == 0) revert EmptyString();
        if (wallet == address(0)) revert ZeroAddressTarget();
        if (charityIdByWallet[wallet] != 0) revert CharityAlreadyExistsByWallet(wallet);

        charityId = ++charityCount;

        _charities[charityId] = Charity({
            charityId: charityId,
            name: name,
            wallet: wallet,
            metadataRecordId: metadataRecordId,
            status: CharityStatus.Active,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        charityIdByWallet[wallet] = charityId;
        activeCharityCount += 1;

        if (defaultCharityId == 0) {
            defaultCharityId = charityId;
            emit DefaultCharityUpdated(0, charityId);
        }

        emit CharityAdded(charityId, name, wallet, metadataRecordId);
    }

    function updateCharity(
        uint256 charityId,
        string calldata newName,
        address newWallet,
        string calldata newMetadataRecordId
    ) external onlyGovernance nonReentrant {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status == CharityStatus.Removed) revert CharityAlreadyRemoved(charityId);
        if (bytes(newName).length == 0) revert EmptyString();
        if (newWallet == address(0)) revert ZeroAddressTarget();

        address oldWallet = charity.wallet;
        if (newWallet != oldWallet) {
            uint256 existingId = charityIdByWallet[newWallet];
            if (existingId != 0 && existingId != charityId) revert CharityAlreadyExistsByWallet(newWallet);
            delete charityIdByWallet[oldWallet];
            charityIdByWallet[newWallet] = charityId;
        }

        charity.name = newName;
        charity.wallet = newWallet;
        charity.metadataRecordId = newMetadataRecordId;
        charity.updatedAt = uint64(block.timestamp);

        emit CharityUpdated(charityId, newName, newWallet, newMetadataRecordId);
    }

    function suspendCharity(uint256 charityId) external onlyGovernance nonReentrant {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status != CharityStatus.Active) revert CharityNotActive(charityId);

        charity.status = CharityStatus.Suspended;
        charity.updatedAt = uint64(block.timestamp);
        activeCharityCount -= 1;

        if (defaultCharityId == charityId) {
            uint256 replacement = _findFirstActiveCharityId();
            defaultCharityId = replacement;
            emit DefaultCharityUpdated(charityId, replacement);
        }

        emit CharitySuspended(charityId);
    }

    function unsuspendCharity(uint256 charityId) external onlyGovernance nonReentrant {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status != CharityStatus.Suspended) revert CharityNotSuspended(charityId);

        charity.status = CharityStatus.Active;
        charity.updatedAt = uint64(block.timestamp);
        activeCharityCount += 1;

        if (defaultCharityId == 0) {
            defaultCharityId = charityId;
            emit DefaultCharityUpdated(0, charityId);
        }

        emit CharityUnsuspended(charityId);
    }

    function removeCharity(uint256 charityId) external onlyGovernance nonReentrant {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status == CharityStatus.Removed) revert CharityAlreadyRemoved(charityId);

        CharityStatus previousStatus = charity.status;
        charity.status = CharityStatus.Removed;
        charity.updatedAt = uint64(block.timestamp);

        delete charityIdByWallet[charity.wallet];

        if (previousStatus == CharityStatus.Active) {
            activeCharityCount -= 1;
        }

        address oldSteward = assignedStewardByCharityId[charityId];
        if (oldSteward != address(0)) {
            delete assignedStewardByCharityId[charityId];
            IStewardRegistry(stewardRegistry).syncCharityAppointment(charityId, oldSteward, address(0));
            emit StewardCleared(charityId);
        }

        if (defaultCharityId == charityId) {
            uint256 replacement = _findFirstActiveCharityId();
            defaultCharityId = replacement;
            emit DefaultCharityUpdated(charityId, replacement);
        }

        emit CharityRemoved(charityId);
    }

    function setDefaultCharity(uint256 charityId) external onlyGovernance {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status != CharityStatus.Active) revert InvalidDefaultCharity(charityId);

        uint256 oldDefault = defaultCharityId;
        defaultCharityId = charityId;
        emit DefaultCharityUpdated(oldDefault, charityId);
    }

    function assignSteward(uint256 charityId, address steward) external onlyGovernance nonReentrant {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status != CharityStatus.Active) revert CharityNotActive(charityId);
        if (steward == address(0)) revert ZeroAddressTarget();

        address oldSteward = assignedStewardByCharityId[charityId];
        assignedStewardByCharityId[charityId] = steward;
        IStewardRegistry(stewardRegistry).syncCharityAppointment(charityId, oldSteward, steward);
        emit StewardAssigned(charityId, steward);
    }

    function clearSteward(uint256 charityId) external onlyGovernance nonReentrant {
        _clearStewardInternal(charityId);
    }

    function syncStewardAssignment(uint256 charityId, address steward) external onlyStewardRegistry {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status == CharityStatus.Removed) revert CharityAlreadyRemoved(charityId);
        assignedStewardByCharityId[charityId] = steward;

        if (steward == address(0)) {
            emit StewardCleared(charityId);
        } else {
            emit StewardAssigned(charityId, steward);
        }
    }

    function resolveActiveCharityOrDefault(uint256 requestedCharityId)
        external
        view
        returns (uint256 resolvedCharityId, address wallet)
    {
        if (requestedCharityId != 0) {
            Charity storage requested = _charities[requestedCharityId];
            if (requested.status == CharityStatus.Active) {
                return (requestedCharityId, requested.wallet);
            }
        }
        resolvedCharityId = defaultCharityId;
        if (resolvedCharityId == 0) revert InvalidDefaultCharity(0);
        Charity storage def = _charities[resolvedCharityId];
        if (def.status != CharityStatus.Active) revert InvalidDefaultCharity(resolvedCharityId);
        wallet = def.wallet;
    }

    function getCharity(uint256 charityId) external view returns (Charity memory) {
        return _getCharityStorage(charityId);
    }

    function getCharityWallet(uint256 charityId) external view returns (address) {
        return _getCharityStorage(charityId).wallet;
    }

    function getDefaultCharityId() external view returns (uint256) {
        return defaultCharityId;
    }

    function getCharityCount() external view returns (uint256) {
        return charityCount;
    }

    function listCharityIds(uint256 cursor, uint256 size)
        external
        view
        returns (uint256[] memory ids, uint256 nextCursor)
    {
        if (cursor >= charityCount || size == 0) {
            return (new uint256[](0), cursor);
        }

        uint256 end = cursor + size;
        if (end > charityCount) end = charityCount;

        ids = new uint256[](end - cursor);
        for (uint256 i = cursor; i < end; ++i) {
            ids[i - cursor] = i + 1;
        }

        nextCursor = end;
    }

    function isActiveCharity(uint256 charityId) external view returns (bool) {
        Charity storage charity = _charities[charityId];
        return charity.status == CharityStatus.Active;
    }

    function _clearStewardInternal(uint256 charityId) internal {
        Charity storage charity = _getCharityStorage(charityId);
        if (charity.status == CharityStatus.Removed) revert CharityAlreadyRemoved(charityId);

        address oldSteward = assignedStewardByCharityId[charityId];
        if (oldSteward != address(0)) {
            delete assignedStewardByCharityId[charityId];
            IStewardRegistry(stewardRegistry).syncCharityAppointment(charityId, oldSteward, address(0));
        }

        emit StewardCleared(charityId);
    }

    function _findFirstActiveCharityId() internal view returns (uint256 foundCharityId) {
        for (uint256 i = 1; i <= charityCount; ++i) {
            if (_charities[i].status == CharityStatus.Active) {
                return i;
            }
        }
        return 0;
    }

    function _getCharityStorage(uint256 charityId) internal view returns (Charity storage charity) {
        charity = _charities[charityId];
        if (charity.status == CharityStatus.None) revert UnknownCharity(charityId);
    }

    function _setGovernance(address newGovernance) internal {
        if (newGovernance == address(0)) revert ZeroAddressGovernance();
        if (newGovernance == governance) revert SameAddress();
        address oldGovernance = governance;
        governance = newGovernance;
        emit GovernanceUpdated(oldGovernance, newGovernance);
    }

    function _setStewardRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressTarget();
        if (newRegistry == stewardRegistry) revert SameAddress();
        address oldRegistry = stewardRegistry;
        stewardRegistry = newRegistry;
        emit StewardRegistryUpdated(oldRegistry, newRegistry);
    }
}
