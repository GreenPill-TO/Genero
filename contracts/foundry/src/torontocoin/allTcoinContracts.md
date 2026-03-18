# TorontoCoin Solidity Contracts

## ./CharityRegistry.sol

```bash sol
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

```

## ./GeneroTokenV3.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ABDKMath64x64} from "../sarafu-read-only/DemurrageTokenSingleNocap.sol";

interface IPoolRegistryForCplTCOIN {
    function isMerchantPosFeeTarget(address wallet) external view returns (bool);
    function getMerchantPaymentConfig(address wallet)
        external
        view
        returns (
            bool exists_,
            bytes32 merchantId_,
            bool approved_,
            bool poolActive_,
            bool acceptsCpl_,
            bool posFeeEligible_,
            bytes32 poolId_
        );
}

interface IUserCharityPreferencesRegistryForCplTCOIN {
    function resolveFeePreferences(address user)
        external
        view
        returns (uint256 resolvedCharityId, address charityWallet, uint16 voluntaryFeeBps);
}

/// @notice Sarafu-style demurrage token for cplTCOIN with merchant POS fee routing.
/// @dev Merchant transfers interpret the visible `_value` as the sticker price.
contract GeneroTokenV3 {
    uint256 constant VALUE_LIMIT = 1 << 63;

    struct redistributionItem {
        uint32 period;
        uint72 value;
        uint64 demurrage;
    }

    struct MerchantTransferQuote {
        bytes32 merchantId;
        uint256 payerDebit;
        uint256 merchantCredit;
        uint256 charityCredit;
        uint256 resolvedCharityId;
        address charityWallet;
        uint16 baseFeeBps;
        uint16 voluntaryFeeBps;
        bool feeApplies;
        uint256 payerDebitBase;
        uint256 merchantCreditBase;
        uint256 charityCreditBase;
    }

    redistributionItem[] public redistributions;
    mapping(address => uint256) account;

    int128 public demurrageAmount;
    uint256 public demurrageTimestamp;

    address public owner;

    string public name;
    string public symbol;
    uint256 public immutable decimals;

    uint256 supply;
    uint256 public lastPeriod;
    uint256 public totalSink;
    uint256 burned;

    uint256 public immutable periodStart;
    uint256 public immutable periodDuration;
    int128 public immutable decayLevel;

    mapping(address => bool) minter;
    mapping(address => mapping(address => uint256)) public allowance;

    address public sinkAddress;
    uint256 public expires;
    bool expired;
    uint256 public maxSupply;

    address public poolRegistry;
    address public charityPreferencesRegistry;

    uint16 public defaultMerchantFeeBps;
    uint16 public constant MAX_BASE_MERCHANT_FEE_BPS = 1000;

    mapping(bytes32 => uint16) private merchantFeeOverrideBps;
    mapping(bytes32 => bool) private merchantFeeOverrideSet;
    mapping(address => bool) public feeExempt;

    bool public merchantFeesEnabled;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
    event Mint(address indexed _minter, address indexed _beneficiary, uint256 _value);
    event Decayed(uint256 indexed _period, uint256 indexed _periodCount, int128 indexed _oldAmount, int128 _newAmount);
    event Period(uint256 _period);
    event Redistribution(address indexed _account, uint256 indexed _period, uint256 _value);
    event Debug(int128 indexed _foo, uint256 indexed _bar);
    event Burn(address indexed _burner, uint256 _value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Expired(uint256 _timestamp);
    event ExpiryChange(uint256 indexed _oldTimestamp, uint256 _newTimestamp);
    event Cap(uint256 indexed _oldCap, uint256 _newCap);

    uint256 public sealState;
    uint8 constant WRITER_STATE = 1;
    uint8 constant SINK_STATE = 2;
    uint8 constant EXPIRY_STATE = 4;
    uint8 constant CAP_STATE = 8;
    uint256 public constant maxSealState = 15;

    event SealStateChange(bool indexed _final, uint256 _sealState);

    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CharityPreferencesRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event MerchantFeesEnabledUpdated(bool enabled);
    event DefaultMerchantFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event MerchantFeeOverrideUpdated(bytes32 indexed merchantId, uint16 oldFeeBps, uint16 newFeeBps);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event MerchantTransferCharged(
        address indexed payer,
        address indexed merchant,
        address indexed charityWallet,
        bytes32 merchantId,
        uint256 displayedAmount,
        uint256 payerDebit,
        uint256 merchantCredit,
        uint256 charityCredit,
        uint16 baseFeeBps,
        uint16 voluntaryFeeBps
    );
    event CharityFeeRouted(
        address indexed payer, uint256 indexed charityId, address indexed charityWallet, uint256 amount
    );

    error ZeroAddressRegistry();
    error ZeroAddressSink();
    error ZeroMerchantId();
    error SameAddress();
    error InvalidMerchantFeeBps(uint16 feeBps, uint16 maxFeeBps);
    error MerchantFeeOverrideAboveDefault(bytes32 merchantId, uint16 feeBps, uint16 defaultFeeBps);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        int128 _decayLevel,
        uint256 _periodMinutes,
        address _defaultSinkAddress,
        address poolRegistry_,
        address charityPreferencesRegistry_,
        uint16 defaultMerchantFeeBps_
    ) {
        require(_decayLevel < (1 << 64));
        redistributionItem memory initialRedistribution;

        owner = msg.sender;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        demurrageTimestamp = block.timestamp;
        periodStart = demurrageTimestamp;
        periodDuration = _periodMinutes * 60;
        demurrageAmount = ABDKMath64x64.fromUInt(1);

        decayLevel = ABDKMath64x64.ln(_decayLevel);
        initialRedistribution = toRedistribution(0, demurrageAmount, 0, 1);
        redistributions.push(initialRedistribution);

        if (_defaultSinkAddress == address(0)) revert ZeroAddressSink();
        sinkAddress = _defaultSinkAddress;

        _setPoolRegistry(poolRegistry_);
        _setCharityPreferencesRegistry(charityPreferencesRegistry_);
        _setDefaultMerchantFeeBps(defaultMerchantFeeBps_);

        merchantFeesEnabled = true;
        emit MerchantFeesEnabledUpdated(true);
    }

    function seal(uint256 _state) public returns (uint256) {
        require(msg.sender == owner);
        require(_state < 16, "ERR_INVALID_STATE");
        require(_state & sealState == 0, "ERR_ALREADY_LOCKED");
        sealState |= _state;
        emit SealStateChange(sealState == maxSealState, sealState);
        return uint256(sealState);
    }

    function isSealed(uint256 _state) public view returns (bool) {
        require(_state < maxSealState);
        if (_state == 0) {
            return sealState == maxSealState;
        }
        return _state & sealState == _state;
    }

    function setExpirePeriod(uint256 _expirePeriod) public {
        uint256 r;
        uint256 oldTimestamp;

        require(!isSealed(EXPIRY_STATE));
        require(!expired);
        require(msg.sender == owner);
        r = periodStart + (_expirePeriod * periodDuration);
        require(r > expires);
        oldTimestamp = expires;
        expires = r;
        emit ExpiryChange(oldTimestamp, expires);
    }

    function setMaxSupply(uint256 _cap) public {
        require(!isSealed(CAP_STATE));
        require(msg.sender == owner);
        require(_cap > totalSupply());
        emit Cap(maxSupply, _cap);
        maxSupply = _cap;
    }

    function setSinkAddress(address _sinkAddress) public {
        require(!isSealed(SINK_STATE));
        require(msg.sender == owner);
        if (_sinkAddress == address(0)) revert ZeroAddressSink();
        sinkAddress = _sinkAddress;
    }

    function setPoolRegistry(address registry) external {
        require(msg.sender == owner);
        _setPoolRegistry(registry);
    }

    function setCharityPreferencesRegistry(address registry) external {
        require(msg.sender == owner);
        _setCharityPreferencesRegistry(registry);
    }

    function setDefaultMerchantFeeBps(uint16 feeBps) external {
        require(msg.sender == owner);
        _setDefaultMerchantFeeBps(feeBps);
    }

    function setMerchantFeeOverride(bytes32 merchantId, uint16 feeBps) external {
        uint16 oldFeeBps;

        require(msg.sender == owner);
        if (merchantId == bytes32(0)) revert ZeroMerchantId();
        if (feeBps > MAX_BASE_MERCHANT_FEE_BPS) revert InvalidMerchantFeeBps(feeBps, MAX_BASE_MERCHANT_FEE_BPS);
        if (feeBps > defaultMerchantFeeBps) {
            revert MerchantFeeOverrideAboveDefault(merchantId, feeBps, defaultMerchantFeeBps);
        }

        oldFeeBps = merchantFeeOverrideSet[merchantId] ? merchantFeeOverrideBps[merchantId] : defaultMerchantFeeBps;
        merchantFeeOverrideBps[merchantId] = feeBps;
        merchantFeeOverrideSet[merchantId] = true;

        emit MerchantFeeOverrideUpdated(merchantId, oldFeeBps, feeBps);
    }

    function clearMerchantFeeOverride(bytes32 merchantId) external {
        uint16 oldFeeBps;

        require(msg.sender == owner);
        if (merchantId == bytes32(0)) revert ZeroMerchantId();

        oldFeeBps = merchantFeeOverrideSet[merchantId] ? merchantFeeOverrideBps[merchantId] : defaultMerchantFeeBps;
        delete merchantFeeOverrideBps[merchantId];
        delete merchantFeeOverrideSet[merchantId];

        emit MerchantFeeOverrideUpdated(merchantId, oldFeeBps, defaultMerchantFeeBps);
    }

    function setFeeExempt(address account_, bool exempt) external {
        require(msg.sender == owner);
        feeExempt[account_] = exempt;
        emit FeeExemptUpdated(account_, exempt);
    }

    function setMerchantFeesEnabled(bool enabled) external {
        require(msg.sender == owner);
        merchantFeesEnabled = enabled;
        emit MerchantFeesEnabledUpdated(enabled);
    }

    function getMerchantFeeOverride(bytes32 merchantId) external view returns (uint16) {
        return merchantFeeOverrideBps[merchantId];
    }

    function hasMerchantFeeOverride(bytes32 merchantId) external view returns (bool) {
        return merchantFeeOverrideSet[merchantId];
    }

    function getEffectiveMerchantFeeBps(address merchantWallet) external view returns (uint16) {
        (, bytes32 merchantId,,,,,) = IPoolRegistryForCplTCOIN(poolRegistry).getMerchantPaymentConfig(merchantWallet);
        if (merchantId == bytes32(0)) {
            return 0;
        }
        return _effectiveMerchantFeeBps(merchantId);
    }

    function feeApplies(address payer, address to) public view returns (bool) {
        if (!merchantFeesEnabled) return false;
        if (feeExempt[payer] || feeExempt[to]) return false;
        return IPoolRegistryForCplTCOIN(poolRegistry).isMerchantPosFeeTarget(to);
    }

    function previewMerchantTransfer(address payer, address to, uint256 displayedAmount)
        external
        view
        returns (
            uint256 payerDebit,
            uint256 merchantCredit,
            uint256 charityCredit,
            uint256 resolvedCharityId,
            address charityWallet,
            uint16 baseFeeBps,
            uint16 voluntaryFeeBps,
            bool feeApplies_
        )
    {
        MerchantTransferQuote memory quote = _quoteMerchantTransfer(payer, to, displayedAmount);
        return (
            quote.payerDebit,
            quote.merchantCredit,
            quote.charityCredit,
            quote.resolvedCharityId,
            quote.charityWallet,
            quote.baseFeeBps,
            quote.voluntaryFeeBps,
            quote.feeApplies
        );
    }

    function applyExpiry() public returns (uint8) {
        if (expired) {
            return 1;
        }
        if (expires == 0) {
            return 0;
        }
        if (block.timestamp >= expires) {
            applyDemurrageLimited(expires - demurrageTimestamp / 60);
            expired = true;
            emit Expired(block.timestamp);
            changePeriod();
            return 2;
        }
        return 0;
    }

    function addWriter(address _minter) public returns (bool) {
        require(!isSealed(WRITER_STATE));
        require(msg.sender == owner);
        minter[_minter] = true;
        return true;
    }

    function deleteWriter(address _minter) public returns (bool) {
        require(!isSealed(WRITER_STATE));
        require(msg.sender == owner || _minter == msg.sender);
        minter[_minter] = false;
        return true;
    }

    function isWriter(address _minter) public view returns (bool) {
        return minter[_minter] || _minter == owner;
    }

    function balanceOf(address _account) public view returns (uint256) {
        int128 baseBalance;
        int128 currentDemurragedAmount;
        uint256 periodCount;

        baseBalance = ABDKMath64x64.fromUInt(baseBalanceOf(_account));
        periodCount = getMinutesDelta(demurrageTimestamp);

        currentDemurragedAmount = ABDKMath64x64.mul(baseBalance, demurrageAmount);
        return decayBy(ABDKMath64x64.toUInt(currentDemurragedAmount), periodCount);
    }

    function baseBalanceOf(address _account) public view returns (uint256) {
        return account[_account];
    }

    function increaseBaseBalance(address _account, uint256 _delta) internal returns (bool) {
        uint256 oldBalance;

        if (_delta == 0) {
            return false;
        }

        oldBalance = baseBalanceOf(_account);
        account[_account] = oldBalance + _delta;
        return true;
    }

    function decreaseBaseBalance(address _account, uint256 _delta) internal returns (bool) {
        uint256 oldBalance;

        if (_delta == 0) {
            return false;
        }

        oldBalance = baseBalanceOf(_account);
        require(oldBalance >= _delta, "ERR_OVERSPEND");
        account[_account] = oldBalance - _delta;
        return true;
    }

    function sweep(address _account) public returns (uint256) {
        uint256 v;

        v = account[msg.sender];
        account[msg.sender] = 0;
        account[_account] += v;
        emit Transfer(msg.sender, _account, v);
        return v;
    }

    function mintTo(address _beneficiary, uint256 _amount) public returns (bool) {
        uint256 baseAmount;

        require(applyExpiry() == 0);
        require(minter[msg.sender] || msg.sender == owner, "ERR_ACCESS");

        changePeriod();
        if (maxSupply > 0) {
            require(supply + _amount <= maxSupply);
        }
        supply += _amount;

        baseAmount = toBaseAmount(_amount);
        increaseBaseBalance(_beneficiary, baseAmount);
        emit Mint(msg.sender, _beneficiary, _amount);
        saveRedistributionSupply();
        return true;
    }

    function mint(address _beneficiary, uint256 _amount, bytes calldata _data) public {
        _data;
        mintTo(_beneficiary, _amount);
    }

    function safeMint(address _beneficiary, uint256 _amount, bytes calldata _data) public {
        _data;
        mintTo(_beneficiary, _amount);
    }

    function toRedistribution(uint256 _participants, int128 _demurrageModifier, uint256 _value, uint256 _period)
        public
        pure
        returns (redistributionItem memory redistribution)
    {
        redistribution.period = uint32(_period);
        redistribution.value = uint72(_value);
        redistribution.demurrage = uint64(uint128(_demurrageModifier) & 0xffffffffffffffff);
        _participants;
    }

    function toRedistributionPeriod(redistributionItem memory _redistribution) public pure returns (uint256) {
        return uint256(_redistribution.period);
    }

    function toRedistributionSupply(redistributionItem memory _redistribution) public pure returns (uint256) {
        return uint256(_redistribution.value);
    }

    function toRedistributionDemurrageModifier(redistributionItem memory _redistribution) public pure returns (int128) {
        int128 r;

        r = int128(int64(_redistribution.demurrage) & int128(0x0000000000000000ffffffffffffffff));
        if (r == 0) {
            r = ABDKMath64x64.fromUInt(1);
        }
        return r;
    }

    function redistributionCount() public view returns (uint256) {
        return redistributions.length;
    }

    function saveRedistributionSupply() internal returns (bool) {
        redistributionItem memory currentRedistribution;
        uint256 grownSupply;

        grownSupply = totalSupply();
        currentRedistribution = redistributions[redistributions.length - 1];
        currentRedistribution.value = uint72(grownSupply);

        redistributions[redistributions.length - 1] = currentRedistribution;
        return true;
    }

    function actualPeriod() public view returns (uint128) {
        return uint128((block.timestamp - periodStart) / periodDuration + 1);
    }

    function checkPeriod() internal view returns (redistributionItem memory) {
        redistributionItem memory lastRedistribution;
        redistributionItem memory emptyRedistribution;
        uint256 currentPeriod;

        lastRedistribution = redistributions[lastPeriod];
        currentPeriod = this.actualPeriod();
        if (currentPeriod <= toRedistributionPeriod(lastRedistribution)) {
            return emptyRedistribution;
        }
        return lastRedistribution;
    }

    function getDistribution(uint256 _supply, int128 _demurrageAmount) public pure returns (uint256) {
        int128 difference;

        difference = ABDKMath64x64.mul(
            ABDKMath64x64.fromUInt(_supply), ABDKMath64x64.sub(ABDKMath64x64.fromUInt(1), _demurrageAmount)
        );
        return _supply - ABDKMath64x64.toUInt(difference);
    }

    function getDistributionFromRedistribution(redistributionItem memory _redistribution)
        public
        pure
        returns (uint256)
    {
        uint256 redistributionSupply;
        int128 redistributionDemurrage;

        redistributionSupply = toRedistributionSupply(_redistribution);
        redistributionDemurrage = toRedistributionDemurrageModifier(_redistribution);
        return getDistribution(redistributionSupply, redistributionDemurrage);
    }

    function applyDefaultRedistribution(redistributionItem memory _redistribution) internal returns (uint256) {
        uint256 unit;
        uint256 baseUnit;

        unit = totalSupply() - getDistributionFromRedistribution(_redistribution);
        baseUnit = toBaseAmount(unit) - totalSink;
        increaseBaseBalance(sinkAddress, baseUnit);
        emit Redistribution(sinkAddress, _redistribution.period, unit);
        lastPeriod += 1;
        totalSink += baseUnit;
        return unit;
    }

    function changePeriod() public returns (bool) {
        redistributionItem memory currentRedistribution;
        redistributionItem memory nextRedistribution;
        redistributionItem memory lastRedistribution;
        uint256 currentPeriod;
        int128 lastDemurrageAmount;
        int128 nextRedistributionDemurrage;
        uint256 demurrageCounts;
        uint256 nextPeriod;

        applyDemurrage();
        currentRedistribution = checkPeriod();
        if (isEmptyRedistribution(currentRedistribution)) {
            return false;
        }

        lastRedistribution = redistributions[lastPeriod];
        currentPeriod = toRedistributionPeriod(currentRedistribution);
        nextPeriod = currentPeriod + 1;
        lastDemurrageAmount = toRedistributionDemurrageModifier(lastRedistribution);
        demurrageCounts = (periodDuration * currentPeriod) / 60;
        nextRedistributionDemurrage =
            ABDKMath64x64.exp(ABDKMath64x64.mul(decayLevel, ABDKMath64x64.fromUInt(demurrageCounts)));
        nextRedistribution = toRedistribution(0, nextRedistributionDemurrage, totalSupply(), nextPeriod);
        redistributions.push(nextRedistribution);

        applyDefaultRedistribution(nextRedistribution);
        emit Period(nextPeriod);
        lastDemurrageAmount;
        return true;
    }

    function getMinutesDelta(uint256 _lastTimestamp) public view returns (uint256) {
        return (block.timestamp - _lastTimestamp) / 60;
    }

    function applyDemurrage() public returns (uint256) {
        return applyDemurrageLimited(0);
    }

    function applyDemurrageLimited(uint256 _rounds) public returns (uint256) {
        int128 v;
        uint256 periodCount;
        int128 periodPoint;
        int128 lastDemurrageAmount;

        if (expired) {
            return 0;
        }

        periodCount = getMinutesDelta(demurrageTimestamp);
        if (periodCount == 0) {
            return 0;
        }
        lastDemurrageAmount = demurrageAmount;

        if (_rounds > 0 && _rounds < periodCount) {
            periodCount = _rounds;
        }

        periodPoint = ABDKMath64x64.fromUInt(periodCount);
        v = ABDKMath64x64.mul(decayLevel, periodPoint);
        v = ABDKMath64x64.exp(v);
        demurrageAmount = ABDKMath64x64.mul(demurrageAmount, v);

        demurrageTimestamp = demurrageTimestamp + (periodCount * 60);
        emit Decayed(demurrageTimestamp, periodCount, lastDemurrageAmount, demurrageAmount);
        return periodCount;
    }

    function getPeriodTimeDelta(uint256 _periodCount) public view returns (uint256) {
        return periodStart + (_periodCount * periodDuration);
    }

    function demurrageCycles(uint256 _target) public view returns (uint256) {
        return (block.timestamp - _target) / 60;
    }

    function isEmptyRedistribution(redistributionItem memory _redistribution) public pure returns (bool) {
        if (_redistribution.period > 0) return false;
        if (_redistribution.value > 0) return false;
        if (_redistribution.demurrage > 0) return false;
        return true;
    }

    function decayBy(uint256 _value, uint256 _period) public view returns (uint256) {
        int128 valuePoint;
        int128 periodPoint;
        int128 v;

        valuePoint = ABDKMath64x64.fromUInt(_value);
        periodPoint = ABDKMath64x64.fromUInt(_period);

        v = ABDKMath64x64.mul(decayLevel, periodPoint);
        v = ABDKMath64x64.exp(v);
        v = ABDKMath64x64.mul(valuePoint, v);
        return ABDKMath64x64.toUInt(v);
    }

    function toBaseAmount(uint256 _value) public view returns (uint256) {
        int128 r;
        r = ABDKMath64x64.div(ABDKMath64x64.fromUInt(_value), demurrageAmount);
        return ABDKMath64x64.toUInt(r);
    }

    function approve(address _spender, uint256 _value) public returns (bool) {
        uint256 baseValue;
        uint8 ex;

        ex = applyExpiry();
        if (ex == 2) {
            return false;
        } else if (ex > 0) {
            revert("EXPIRED");
        }
        if (allowance[msg.sender][_spender] > 0) {
            require(_value == 0, "ZERO_FIRST");
        }

        changePeriod();

        if (_value <= VALUE_LIMIT) {
            baseValue = toBaseAmount(_value);
        } else {
            baseValue = VALUE_LIMIT;
        }

        allowance[msg.sender][_spender] = baseValue;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function decreaseAllowance(address _spender, uint256 _value) public returns (bool) {
        uint256 baseValue;

        baseValue = toBaseAmount(_value);
        require(allowance[msg.sender][_spender] >= baseValue);

        changePeriod();

        allowance[msg.sender][_spender] -= baseValue;
        emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
        return true;
    }

    function increaseAllowance(address _spender, uint256 _value) public returns (bool) {
        uint256 baseValue;

        changePeriod();

        baseValue = toBaseAmount(_value);

        allowance[msg.sender][_spender] += baseValue;
        emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
        return true;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        uint256 baseValue;
        bool result;
        uint8 ex;

        ex = applyExpiry();
        if (ex == 2) {
            return false;
        } else if (ex > 0) {
            revert("EXPIRED");
        }
        changePeriod();

        if (feeApplies(msg.sender, _to)) {
            return _transferWithMerchantFee(msg.sender, _to, _value);
        }

        baseValue = toBaseAmount(_value);
        result = transferBase(msg.sender, _to, baseValue);
        emit Transfer(msg.sender, _to, _value);
        return result;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        uint256 baseValue;
        bool result;
        uint8 ex;

        ex = applyExpiry();
        if (ex == 2) {
            return false;
        } else if (ex > 0) {
            revert("EXPIRED");
        }
        changePeriod();

        if (feeApplies(_from, _to)) {
            MerchantTransferQuote memory quote = _quoteMerchantTransfer(_from, _to, _value);
            require(allowance[_from][msg.sender] >= quote.payerDebitBase, "ERR_SPENDER");
            allowance[_from][msg.sender] -= quote.payerDebitBase;
            return _executeMerchantTransfer(_from, _to, _value, quote);
        }

        baseValue = toBaseAmount(_value);
        require(allowance[_from][msg.sender] >= baseValue, "ERR_SPENDER");

        allowance[_from][msg.sender] -= baseValue;
        result = transferBase(_from, _to, baseValue);

        emit Transfer(_from, _to, _value);
        return result;
    }

    function transferBase(address _from, address _to, uint256 _value) internal returns (bool) {
        decreaseBaseBalance(_from, _value);
        increaseBaseBalance(_to, _value);

        return true;
    }

    function transferOwnership(address _newOwner) public returns (bool) {
        address oldOwner;

        require(msg.sender == owner);
        oldOwner = owner;
        owner = _newOwner;

        emit OwnershipTransferred(oldOwner, owner);
        return true;
    }

    function burn(uint256 _value) public returns (bool) {
        require(applyExpiry() == 0);
        require(minter[msg.sender] || msg.sender == owner, "ERR_ACCESS");
        require(_value <= account[msg.sender]);
        uint256 _delta = toBaseAmount(_value);

        decreaseBaseBalance(msg.sender, _delta);
        burned += _value;
        emit Burn(msg.sender, _value);
        return true;
    }

    function burn(address _from, uint256 _value, bytes calldata _data) public {
        require(_from == msg.sender, "ERR_ONLY_SELF_BURN");
        _data;
        burn(_value);
    }

    function burn() public returns (bool) {
        return burn(account[msg.sender]);
    }

    function totalSupply() public view returns (uint256) {
        return supply - burned;
    }

    function totalBurned() public view returns (uint256) {
        return burned;
    }

    function totalMinted() public view returns (uint256) {
        return supply;
    }

    function supportsInterface(bytes4 _sum) public pure returns (bool) {
        if (_sum == 0xb61bc941) return true;
        if (_sum == 0x5878bcf4) return true;
        if (_sum == 0xbc4babdd) return true;
        if (_sum == 0x0d7491f8) return true;
        if (_sum == 0xabe1f1f5) return true;
        if (_sum == 0x841a0e94) return true;
        if (_sum == 0x01ffc9a7) return true;
        if (_sum == 0x9493f8b2) return true;
        if (_sum == 0xd0017968) return true;
        return false;
    }

    function _transferWithMerchantFee(address payer, address merchant, uint256 displayedAmount)
        internal
        returns (bool)
    {
        MerchantTransferQuote memory quote = _quoteMerchantTransfer(payer, merchant, displayedAmount);
        return _executeMerchantTransfer(payer, merchant, displayedAmount, quote);
    }

    function _executeMerchantTransfer(
        address payer,
        address merchant,
        uint256 displayedAmount,
        MerchantTransferQuote memory quote
    ) internal returns (bool) {
        decreaseBaseBalance(payer, quote.payerDebitBase);
        increaseBaseBalance(merchant, quote.merchantCreditBase);
        increaseBaseBalance(quote.charityWallet, quote.charityCreditBase);

        emit Transfer(payer, merchant, quote.merchantCredit);
        if (quote.charityCredit > 0) {
            emit Transfer(payer, quote.charityWallet, quote.charityCredit);
            emit CharityFeeRouted(payer, quote.resolvedCharityId, quote.charityWallet, quote.charityCredit);
        }

        emit MerchantTransferCharged(
            payer,
            merchant,
            quote.charityWallet,
            quote.merchantId,
            displayedAmount,
            quote.payerDebit,
            quote.merchantCredit,
            quote.charityCredit,
            quote.baseFeeBps,
            quote.voluntaryFeeBps
        );

        return true;
    }

    function _quoteMerchantTransfer(address payer, address to, uint256 displayedAmount)
        internal
        view
        returns (MerchantTransferQuote memory quote)
    {
        if (!feeApplies(payer, to)) {
            quote.payerDebit = displayedAmount;
            quote.merchantCredit = displayedAmount;
            return quote;
        }

        (, quote.merchantId,,,,,) = IPoolRegistryForCplTCOIN(poolRegistry).getMerchantPaymentConfig(to);
        quote.feeApplies = true;
        quote.baseFeeBps = _effectiveMerchantFeeBps(quote.merchantId);
        (quote.resolvedCharityId, quote.charityWallet, quote.voluntaryFeeBps) =
            IUserCharityPreferencesRegistryForCplTCOIN(charityPreferencesRegistry).resolveFeePreferences(payer);

        uint256 baseFeeVisible = displayedAmount * quote.baseFeeBps / 10_000;
        uint256 voluntaryFeeVisible = displayedAmount * quote.voluntaryFeeBps / 10_000;

        quote.payerDebit = displayedAmount + voluntaryFeeVisible;
        quote.merchantCredit = displayedAmount - baseFeeVisible;
        quote.charityCredit = baseFeeVisible + voluntaryFeeVisible;

        quote.payerDebitBase = toBaseAmount(quote.payerDebit);
        quote.merchantCreditBase = toBaseAmount(quote.merchantCredit);
        quote.charityCreditBase = quote.payerDebitBase - quote.merchantCreditBase;
    }

    function _effectiveMerchantFeeBps(bytes32 merchantId) internal view returns (uint16) {
        uint16 overrideBps;

        if (merchantId == bytes32(0)) {
            return defaultMerchantFeeBps;
        }
        if (!merchantFeeOverrideSet[merchantId]) {
            return defaultMerchantFeeBps;
        }

        overrideBps = merchantFeeOverrideBps[merchantId];
        if (overrideBps > defaultMerchantFeeBps) {
            return defaultMerchantFeeBps;
        }
        return overrideBps;
    }

    function _setPoolRegistry(address registry) internal {
        address oldRegistry = poolRegistry;

        if (registry == address(0)) revert ZeroAddressRegistry();
        if (registry == oldRegistry) revert SameAddress();

        poolRegistry = registry;
        emit PoolRegistryUpdated(oldRegistry, registry);
    }

    function _setCharityPreferencesRegistry(address registry) internal {
        address oldRegistry = charityPreferencesRegistry;

        if (registry == address(0)) revert ZeroAddressRegistry();
        if (registry == oldRegistry) revert SameAddress();

        charityPreferencesRegistry = registry;
        emit CharityPreferencesRegistryUpdated(oldRegistry, registry);
    }

    function _setDefaultMerchantFeeBps(uint16 feeBps) internal {
        uint16 oldFeeBps = defaultMerchantFeeBps;

        if (feeBps > MAX_BASE_MERCHANT_FEE_BPS) revert InvalidMerchantFeeBps(feeBps, MAX_BASE_MERCHANT_FEE_BPS);

        defaultMerchantFeeBps = feeBps;
        emit DefaultMerchantFeeUpdated(oldFeeBps, feeBps);
    }
}

```

## ./Governance.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ICharityRegistry} from "./interfaces/ICharityRegistry.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {IReserveRegistry} from "./interfaces/IReserveRegistry.sol";
import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";
import {ITCOINToken} from "./interfaces/ITCOINToken.sol";
import {ITreasuryController} from "./interfaces/ITreasuryController.sol";

contract Governance is Ownable, ReentrancyGuard {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant CAD_PEG_MAX_DELTA_BPS = 1_000; // 10%
    uint256 public constant MINIMUM_PARTICIPATION_WEIGHT = 1;

    enum ProposalType {
        CharityAdd,
        CharityRemove,
        CharitySuspend,
        CharityUnsuspend,
        SetDefaultCharity,
        PoolAdd,
        PoolRemove,
        PoolSuspend,
        PoolUnsuspend,
        MerchantApprove,
        MerchantRemove,
        MerchantSuspend,
        MerchantUnsuspend,
        MerchantPoolReassign,
        ReserveAssetAdd,
        ReserveAssetRemove,
        ReserveAssetPause,
        ReserveAssetUnpause,
        ReserveOracleUpdate,
        CadPegUpdate,
        UserRedeemRateUpdate,
        MerchantRedeemRateUpdate,
        CharityMintRateUpdate,
        OvercollateralizationTargetUpdate,
        CharityMintFromExcess,
        DemurrageRateUpdate
    }

    enum ProposalStatus {
        None,
        Pending,
        Approved,
        Rejected,
        Executed,
        Cancelled
    }

    struct Proposal {
        uint256 proposalId;
        ProposalType proposalType;
        ProposalStatus status;
        address proposer;
        uint64 createdAt;
        uint64 deadline;
        uint256 yesWeight;
        uint256 noWeight;
        uint256 totalSnapshotWeight;
        uint256 participationWeight;
    }

    struct CharityAddPayload {
        string name;
        address wallet;
        string metadataRecordId;
    }

    struct CharityIdPayload {
        uint256 charityId;
    }

    struct PoolAddPayload {
        bytes32 poolId;
        string name;
        string metadataRecordId;
    }

    struct Bytes32IdPayload {
        bytes32 id;
    }

    struct MerchantApprovePayload {
        bytes32 merchantId;
        bytes32 poolId;
        string metadataRecordId;
        address[] initialWallets;
    }

    struct MerchantIdPayload {
        bytes32 merchantId;
    }

    struct MerchantPoolReassignPayload {
        bytes32 merchantId;
        bytes32 newPoolId;
    }

    struct ReserveAssetAddPayload {
        bytes32 assetId;
        address token;
        string code;
        uint8 tokenDecimals;
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
    }

    struct ReserveOracleUpdatePayload {
        bytes32 assetId;
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
    }

    struct UIntPayload {
        uint256 value;
    }

    struct CharityMintPayload {
        uint256 charityId;
        uint256 amount;
    }

    error ZeroAddressOwner();
    error ZeroAddressRegistry();
    error ZeroAddressTarget();
    error NotSteward(address caller);
    error UnknownProposal(uint256 proposalId);
    error ProposalNotPending(uint256 proposalId);
    error ProposalNotApproved(uint256 proposalId);
    error ProposalExpired(uint256 proposalId);
    error ProposalAlreadyVoted(uint256 proposalId, address steward);
    error ProposalExecutionBeforeDeadline(uint256 proposalId, uint64 deadline, uint256 currentTimestamp);
    error InvalidVotingWindow();
    error InvalidProposalValue();
    error InvalidPegChange(uint256 oldPeg, uint256 newPeg);
    error Unauthorized();
    error EmptyString();
    error NoSnapshotWeight(uint256 proposalId, address steward);

    event StewardRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event ReserveRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event TreasuryControllerUpdated(address indexed oldController, address indexed newController);
    event TcoinTokenUpdated(address indexed oldToken, address indexed newToken);
    event DefaultVotingWindowUpdated(uint64 oldWindow, uint64 newWindow);

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType indexed proposalType,
        address indexed proposer,
        uint64 deadline,
        uint256 totalSnapshotWeight
    );

    event ProposalVoted(
        uint256 indexed proposalId,
        address indexed steward,
        bool support,
        uint256 weight,
        uint256 yesWeight,
        uint256 noWeight
    );

    event ProposalApproved(uint256 indexed proposalId);
    event ProposalRejected(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId, address indexed actor);
    event ProposalCancelled(uint256 indexed proposalId, address indexed actor);

    address public stewardRegistry;
    address public charityRegistry;
    address public poolRegistry;
    address public reserveRegistry;
    address public treasuryController;
    address public tcoinToken;

    uint64 public defaultVotingWindow;
    uint256 public proposalCount;

    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => uint256)) private stewardSnapshotWeight;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    mapping(uint256 => CharityAddPayload) private charityAddPayloads;
    mapping(uint256 => CharityIdPayload) private charityIdPayloads;
    mapping(uint256 => PoolAddPayload) private poolAddPayloads;
    mapping(uint256 => Bytes32IdPayload) private bytes32IdPayloads;
    mapping(uint256 => MerchantApprovePayload) private merchantApprovePayloads;
    mapping(uint256 => MerchantIdPayload) private merchantIdPayloads;
    mapping(uint256 => MerchantPoolReassignPayload) private merchantPoolReassignPayloads;
    mapping(uint256 => ReserveAssetAddPayload) private reserveAssetAddPayloads;
    mapping(uint256 => ReserveOracleUpdatePayload) private reserveOracleUpdatePayloads;
    mapping(uint256 => UIntPayload) private uintPayloads;
    mapping(uint256 => CharityMintPayload) private charityMintPayloads;

    constructor(
        address initialOwner,
        address stewardRegistry_,
        address charityRegistry_,
        address poolRegistry_,
        address reserveRegistry_,
        address treasuryController_,
        address tcoinToken_,
        uint64 defaultVotingWindow_
    ) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
        _setStewardRegistry(stewardRegistry_);
        _setCharityRegistry(charityRegistry_);
        _setPoolRegistry(poolRegistry_);
        _setReserveRegistry(reserveRegistry_);
        _setTreasuryController(treasuryController_);
        _setTcoinToken(tcoinToken_);
        _setDefaultVotingWindow(defaultVotingWindow_);
    }

    modifier onlySteward() {
        if (!IStewardRegistry(stewardRegistry).isSteward(msg.sender)) {
            revert NotSteward(msg.sender);
        }
        _;
    }

    modifier onlyPendingProposal(uint256 proposalId) {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (proposal.status != ProposalStatus.Pending) revert ProposalNotPending(proposalId);
        _;
    }

    function setStewardRegistry(address newRegistry) external onlyOwner {
        _setStewardRegistry(newRegistry);
    }

    function setCharityRegistry(address newRegistry) external onlyOwner {
        _setCharityRegistry(newRegistry);
    }

    function setPoolRegistry(address newRegistry) external onlyOwner {
        _setPoolRegistry(newRegistry);
    }

    function setReserveRegistry(address newRegistry) external onlyOwner {
        _setReserveRegistry(newRegistry);
    }

    function setTreasuryController(address newController) external onlyOwner {
        _setTreasuryController(newController);
    }

    function setTcoinToken(address newToken) external onlyOwner {
        _setTcoinToken(newToken);
    }

    function setDefaultVotingWindow(uint64 newWindow) external onlyOwner {
        _setDefaultVotingWindow(newWindow);
    }

    function proposeCharityAdd(
        string calldata name,
        address wallet,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (bytes(name).length == 0) revert EmptyString();
        if (wallet == address(0)) revert ZeroAddressTarget();

        proposalId = _createProposal(ProposalType.CharityAdd, votingWindow);
        charityAddPayloads[proposalId] = CharityAddPayload({
            name: name,
            wallet: wallet,
            metadataRecordId: metadataRecordId
        });
    }

    function proposeCharityRemove(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.CharityRemove, charityId, votingWindow);
    }

    function proposeCharitySuspend(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.CharitySuspend, charityId, votingWindow);
    }

    function proposeCharityUnsuspend(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.CharityUnsuspend, charityId, votingWindow);
    }

    function proposeSetDefaultCharity(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.SetDefaultCharity, charityId, votingWindow);
    }

    function proposePoolAdd(
        bytes32 poolId,
        string calldata name,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (poolId == bytes32(0)) revert InvalidProposalValue();
        if (bytes(name).length == 0) revert EmptyString();

        proposalId = _createProposal(ProposalType.PoolAdd, votingWindow);
        poolAddPayloads[proposalId] = PoolAddPayload({
            poolId: poolId,
            name: name,
            metadataRecordId: metadataRecordId
        });
    }

    function proposePoolRemove(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.PoolRemove, poolId, votingWindow);
    }

    function proposePoolSuspend(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.PoolSuspend, poolId, votingWindow);
    }

    function proposePoolUnsuspend(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.PoolUnsuspend, poolId, votingWindow);
    }

    function proposeMerchantApprove(
        bytes32 merchantId,
        bytes32 poolId,
        string calldata metadataRecordId,
        address[] calldata initialWallets,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (merchantId == bytes32(0)) revert InvalidProposalValue();
        if (poolId == bytes32(0)) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.MerchantApprove, votingWindow);
        MerchantApprovePayload storage payload = merchantApprovePayloads[proposalId];
        payload.merchantId = merchantId;
        payload.poolId = poolId;
        payload.metadataRecordId = metadataRecordId;

        for (uint256 i = 0; i < initialWallets.length; ++i) {
            if (initialWallets[i] == address(0)) revert ZeroAddressTarget();
            payload.initialWallets.push(initialWallets[i]);
        }
    }

    function proposeMerchantRemove(bytes32 merchantId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantId(ProposalType.MerchantRemove, merchantId, votingWindow);
    }

    function proposeMerchantSuspend(bytes32 merchantId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantId(ProposalType.MerchantSuspend, merchantId, votingWindow);
    }

    function proposeMerchantUnsuspend(bytes32 merchantId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantId(ProposalType.MerchantUnsuspend, merchantId, votingWindow);
    }

    function proposeMerchantPoolReassign(
        bytes32 merchantId,
        bytes32 newPoolId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (merchantId == bytes32(0)) revert InvalidProposalValue();
        if (newPoolId == bytes32(0)) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.MerchantPoolReassign, votingWindow);
        merchantPoolReassignPayloads[proposalId] = MerchantPoolReassignPayload({
            merchantId: merchantId,
            newPoolId: newPoolId
        });
    }

    function proposeReserveAssetAdd(
        bytes32 assetId,
        address token,
        string calldata code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (assetId == bytes32(0)) revert InvalidProposalValue();
        if (token == address(0)) revert ZeroAddressTarget();
        if (bytes(code).length == 0) revert EmptyString();
        if (primaryOracle == address(0)) revert ZeroAddressTarget();
        if (staleAfter == 0) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.ReserveAssetAdd, votingWindow);
        reserveAssetAddPayloads[proposalId] = ReserveAssetAddPayload({
            assetId: assetId,
            token: token,
            code: code,
            tokenDecimals: tokenDecimals,
            primaryOracle: primaryOracle,
            fallbackOracle: fallbackOracle,
            staleAfter: staleAfter
        });
    }

    function proposeReserveAssetRemove(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.ReserveAssetRemove, assetId, votingWindow);
    }

    function proposeReserveAssetPause(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.ReserveAssetPause, assetId, votingWindow);
    }

    function proposeReserveAssetUnpause(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.ReserveAssetUnpause, assetId, votingWindow);
    }

    function proposeReserveOracleUpdate(
        bytes32 assetId,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (assetId == bytes32(0)) revert InvalidProposalValue();
        if (primaryOracle == address(0)) revert ZeroAddressTarget();
        if (staleAfter == 0) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.ReserveOracleUpdate, votingWindow);
        reserveOracleUpdatePayloads[proposalId] = ReserveOracleUpdatePayload({
            assetId: assetId,
            primaryOracle: primaryOracle,
            fallbackOracle: fallbackOracle,
            staleAfter: staleAfter
        });
    }

    function proposeCadPegUpdate(uint256 newCadPeg18, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (newCadPeg18 == 0) revert InvalidProposalValue();
        _validateCadPegChange(newCadPeg18);

        proposalId = _createProposal(ProposalType.CadPegUpdate, votingWindow);
        uintPayloads[proposalId] = UIntPayload({value: newCadPeg18});
    }

    function proposeUserRedeemRateUpdate(uint256 newRateBps, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeRateLike(ProposalType.UserRedeemRateUpdate, newRateBps, votingWindow);
    }

    function proposeMerchantRedeemRateUpdate(uint256 newRateBps, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeRateLike(ProposalType.MerchantRedeemRateUpdate, newRateBps, votingWindow);
    }

    function proposeCharityMintRateUpdate(uint256 newRateBps, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeRateLike(ProposalType.CharityMintRateUpdate, newRateBps, votingWindow);
    }

    function proposeDemurrageRateUpdate(uint256 newRate, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (newRate == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.DemurrageRateUpdate, votingWindow);
        uintPayloads[proposalId] = UIntPayload({value: newRate});
    }

    function proposeOvercollateralizationTargetUpdate(uint256 newTarget18, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (newTarget18 == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.OvercollateralizationTargetUpdate, votingWindow);
        uintPayloads[proposalId] = UIntPayload({value: newTarget18});
    }

    function proposeMintToDefaultCharity(uint256 amount, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (amount == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.CharityMintFromExcess, votingWindow);
        charityMintPayloads[proposalId] = CharityMintPayload({charityId: 0, amount: amount});
    }

    function proposeMintToCharity(uint256 charityId, uint256 amount, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (charityId == 0) revert InvalidProposalValue();
        if (amount == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.CharityMintFromExcess, votingWindow);
        charityMintPayloads[proposalId] = CharityMintPayload({charityId: charityId, amount: amount});
    }

    /// @notice Cast a weighted steward vote on a pending proposal.
    /// @dev A proposal can move to Approved before deadline if quorum and majority conditions are met.
    function voteProposal(uint256 proposalId, bool support) external onlySteward onlyPendingProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp > proposal.deadline) revert ProposalExpired(proposalId);
        if (hasVoted[proposalId][msg.sender]) revert ProposalAlreadyVoted(proposalId, msg.sender);

        uint256 weight = stewardSnapshotWeight[proposalId][msg.sender];
        if (weight == 0) revert NoSnapshotWeight(proposalId, msg.sender);

        hasVoted[proposalId][msg.sender] = true;
        proposal.participationWeight += weight;

        if (support) {
            proposal.yesWeight += weight;
        } else {
            proposal.noWeight += weight;
        }

        emit ProposalVoted(proposalId, msg.sender, support, weight, proposal.yesWeight, proposal.noWeight);

        if (_shouldApprove(proposal)) {
            proposal.status = ProposalStatus.Approved;
            emit ProposalApproved(proposalId);
        }
    }

    /// @notice Finalize an expired pending proposal as Approved or Rejected.
    function refreshProposalStatus(uint256 proposalId) public {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (proposal.status != ProposalStatus.Pending) return;
        if (block.timestamp <= proposal.deadline) return;

        if (_shouldApprove(proposal)) {
            proposal.status = ProposalStatus.Approved;
            emit ProposalApproved(proposalId);
        } else {
            proposal.status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
        }
    }

    /// @notice Execute an approved proposal after the proposal deadline has passed.
    /// @dev Execution is deadline-gated even if early approval happened before expiry.
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (block.timestamp < proposal.deadline) {
            revert ProposalExecutionBeforeDeadline(proposalId, proposal.deadline, block.timestamp);
        }

        refreshProposalStatus(proposalId);

        proposal = _getProposalStorage(proposalId);
        if (proposal.status != ProposalStatus.Approved) revert ProposalNotApproved(proposalId);

        ProposalType proposalType = proposal.proposalType;

        if (proposalType == ProposalType.CharityAdd) {
            CharityAddPayload storage payload = charityAddPayloads[proposalId];
            ICharityRegistry(charityRegistry).addCharity(payload.name, payload.wallet, payload.metadataRecordId);
        } else if (proposalType == ProposalType.CharityRemove) {
            ICharityRegistry(charityRegistry).removeCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.CharitySuspend) {
            ICharityRegistry(charityRegistry).suspendCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.CharityUnsuspend) {
            ICharityRegistry(charityRegistry).unsuspendCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.SetDefaultCharity) {
            ICharityRegistry(charityRegistry).setDefaultCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.PoolAdd) {
            PoolAddPayload storage payload = poolAddPayloads[proposalId];
            IPoolRegistry(poolRegistry).addPool(payload.poolId, payload.name, payload.metadataRecordId);
        } else if (proposalType == ProposalType.PoolRemove) {
            IPoolRegistry(poolRegistry).removePool(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.PoolSuspend) {
            IPoolRegistry(poolRegistry).suspendPool(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.PoolUnsuspend) {
            IPoolRegistry(poolRegistry).unsuspendPool(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.MerchantApprove) {
            MerchantApprovePayload storage payload = merchantApprovePayloads[proposalId];
            IPoolRegistry(poolRegistry).approveMerchant(
                payload.merchantId, payload.poolId, payload.metadataRecordId, payload.initialWallets
            );
        } else if (proposalType == ProposalType.MerchantRemove) {
            IPoolRegistry(poolRegistry).removeMerchant(merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == ProposalType.MerchantSuspend) {
            IPoolRegistry(poolRegistry).suspendMerchant(merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == ProposalType.MerchantUnsuspend) {
            IPoolRegistry(poolRegistry).unsuspendMerchant(merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == ProposalType.MerchantPoolReassign) {
            MerchantPoolReassignPayload storage payload = merchantPoolReassignPayloads[proposalId];
            IPoolRegistry(poolRegistry).reassignMerchantPool(payload.merchantId, payload.newPoolId);
        } else if (proposalType == ProposalType.ReserveAssetAdd) {
            ReserveAssetAddPayload storage payload = reserveAssetAddPayloads[proposalId];
            IReserveRegistry(reserveRegistry).addReserveAsset(
                payload.assetId,
                payload.token,
                payload.code,
                payload.tokenDecimals,
                payload.primaryOracle,
                payload.fallbackOracle,
                payload.staleAfter
            );
        } else if (proposalType == ProposalType.ReserveAssetRemove) {
            IReserveRegistry(reserveRegistry).removeReserveAsset(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveAssetPause) {
            IReserveRegistry(reserveRegistry).pauseReserveAsset(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveAssetUnpause) {
            IReserveRegistry(reserveRegistry).unpauseReserveAsset(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveOracleUpdate) {
            ReserveOracleUpdatePayload storage payload = reserveOracleUpdatePayloads[proposalId];
            IReserveRegistry(reserveRegistry).updateReserveAssetOracles(
                payload.assetId,
                payload.primaryOracle,
                payload.fallbackOracle
            );
            IReserveRegistry(reserveRegistry).updateReserveAssetStaleness(payload.assetId, payload.staleAfter);
        } else if (proposalType == ProposalType.CadPegUpdate) {
            uint256 newCadPeg18 = uintPayloads[proposalId].value;
            _validateCadPegChange(newCadPeg18);
            ITreasuryController(treasuryController).setCadPeg(newCadPeg18);
        } else if (proposalType == ProposalType.UserRedeemRateUpdate) {
            ITreasuryController(treasuryController).setUserRedeemRate(uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.MerchantRedeemRateUpdate) {
            ITreasuryController(treasuryController).setMerchantRedeemRate(uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.CharityMintRateUpdate) {
            ITreasuryController(treasuryController).setCharityMintRate(uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.OvercollateralizationTargetUpdate) {
            ITreasuryController(treasuryController).setOvercollateralizationTarget(uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.CharityMintFromExcess) {
            CharityMintPayload storage payload = charityMintPayloads[proposalId];
            if (payload.charityId == 0) {
                ITreasuryController(treasuryController).mintToCharity(payload.amount);
            } else {
                ITreasuryController(treasuryController).mintToCharity(payload.charityId, payload.amount);
            }
        } else if (proposalType == ProposalType.DemurrageRateUpdate) {
            ITCOINToken(tcoinToken).setExpirePeriod(uintPayloads[proposalId].value);
        } else {
            revert InvalidProposalValue();
        }

        proposal.status = ProposalStatus.Executed;
        emit ProposalExecuted(proposalId, msg.sender);
    }

    /// @notice Owner-only cancellation hook for non-executed proposals.
    function cancelProposal(uint256 proposalId) external onlyOwner {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (proposal.status == ProposalStatus.Executed || proposal.status == ProposalStatus.Cancelled) {
            revert Unauthorized();
        }
        proposal.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(proposalId, msg.sender);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _getProposalStorage(proposalId);
    }

    function getSnapshotWeight(uint256 proposalId, address steward) external view returns (uint256) {
        return stewardSnapshotWeight[proposalId][steward];
    }

    function getProposalCount() external view returns (uint256) {
        return proposalCount;
    }

    function listProposalIds(uint256 cursor, uint256 size)
        external
        view
        returns (uint256[] memory ids, uint256 nextCursor)
    {
        if (cursor >= proposalCount || size == 0) {
            return (new uint256[](0), cursor);
        }

        uint256 end = cursor + size;
        if (end > proposalCount) end = proposalCount;

        ids = new uint256[](end - cursor);
        for (uint256 i = cursor; i < end; ++i) {
            ids[i - cursor] = i + 1;
        }

        nextCursor = end;
    }

    function _proposeCharityId(
        ProposalType proposalType,
        uint256 charityId,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (charityId == 0) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        charityIdPayloads[proposalId] = CharityIdPayload({charityId: charityId});
    }

    function _proposeBytes32Id(
        ProposalType proposalType,
        bytes32 id,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (id == bytes32(0)) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        bytes32IdPayloads[proposalId] = Bytes32IdPayload({id: id});
    }

    function _proposeMerchantId(
        ProposalType proposalType,
        bytes32 merchantId,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (merchantId == bytes32(0)) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        merchantIdPayloads[proposalId] = MerchantIdPayload({merchantId: merchantId});
    }

    function _proposeRateLike(
        ProposalType proposalType,
        uint256 value,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (value > BPS_DENOMINATOR) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        uintPayloads[proposalId] = UIntPayload({value: value});
    }

    function _createProposal(ProposalType proposalType, uint64 votingWindow) internal returns (uint256 proposalId) {
        uint64 window = votingWindow == 0 ? defaultVotingWindow : votingWindow;
        if (window == 0) revert InvalidVotingWindow();

        proposalId = ++proposalCount;
        uint64 createdAt = uint64(block.timestamp);
        uint64 deadline = createdAt + window;

        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposalType = proposalType;
        proposal.status = ProposalStatus.Pending;
        proposal.proposer = msg.sender;
        proposal.createdAt = createdAt;
        proposal.deadline = deadline;

        uint256 totalSnapshotWeight = _snapshotStewardWeights(proposalId);
        proposal.totalSnapshotWeight = totalSnapshotWeight;

        emit ProposalCreated(proposalId, proposalType, msg.sender, deadline, totalSnapshotWeight);
    }

    function _snapshotStewardWeights(uint256 proposalId) internal returns (uint256 totalSnapshotWeight) {
        address[] memory stewards = IStewardRegistry(stewardRegistry).listStewardAddresses();

        for (uint256 i = 0; i < stewards.length; ++i) {
            address steward = stewards[i];
            uint256 weight = IStewardRegistry(stewardRegistry).getStewardWeight(steward);
            if (weight == 0) continue;

            stewardSnapshotWeight[proposalId][steward] = weight;
            totalSnapshotWeight += weight;
        }
    }

    function _shouldApprove(Proposal storage proposal) internal view returns (bool) {
        return proposal.yesWeight > proposal.noWeight && proposal.participationWeight >= MINIMUM_PARTICIPATION_WEIGHT;
    }

    function _validateCadPegChange(uint256 newCadPeg18) internal view {
        uint256 oldPeg = ITreasuryController(treasuryController).cadPeg18();
        if (oldPeg == 0 || newCadPeg18 == 0) revert InvalidProposalValue();

        uint256 lowerBound = oldPeg - ((oldPeg * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);
        uint256 upperBound = oldPeg + ((oldPeg * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);

        if (newCadPeg18 < lowerBound || newCadPeg18 > upperBound) {
            revert InvalidPegChange(oldPeg, newCadPeg18);
        }
    }

    function _getProposalStorage(uint256 proposalId) internal view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (proposal.status == ProposalStatus.None) revert UnknownProposal(proposalId);
    }

    function _setStewardRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = stewardRegistry;
        stewardRegistry = newRegistry;
        emit StewardRegistryUpdated(old, newRegistry);
    }

    function _setCharityRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = charityRegistry;
        charityRegistry = newRegistry;
        emit CharityRegistryUpdated(old, newRegistry);
    }

    function _setPoolRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = poolRegistry;
        poolRegistry = newRegistry;
        emit PoolRegistryUpdated(old, newRegistry);
    }

    function _setReserveRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = reserveRegistry;
        reserveRegistry = newRegistry;
        emit ReserveRegistryUpdated(old, newRegistry);
    }

    function _setTreasuryController(address newController) internal {
        if (newController == address(0)) revert ZeroAddressRegistry();
        address old = treasuryController;
        treasuryController = newController;
        emit TreasuryControllerUpdated(old, newController);
    }

    function _setTcoinToken(address newToken) internal {
        if (newToken == address(0)) revert ZeroAddressRegistry();
        address old = tcoinToken;
        tcoinToken = newToken;
        emit TcoinTokenUpdated(old, newToken);
    }

    function _setDefaultVotingWindow(uint64 newWindow) internal {
        if (newWindow == 0) revert InvalidVotingWindow();
        uint64 oldWindow = defaultVotingWindow;
        defaultVotingWindow = newWindow;
        emit DefaultVotingWindowUpdated(oldWindow, newWindow);
    }
}

```

## ./OracleRouter.sol

```bash sol
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

```

## ./PoolRegistry.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract PoolRegistry is Ownable, Pausable {
    enum PoolStatus {
        None,
        Active,
        Suspended,
        Removed
    }

    enum MerchantStatus {
        None,
        Approved,
        Suspended,
        Removed
    }

    struct Pool {
        bytes32 poolId;
        string name;
        string metadataRecordId;
        PoolStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct MerchantEntity {
        bytes32 merchantId;
        bytes32 poolId;
        string metadataRecordId;
        MerchantStatus status;
        bool acceptsCplTcoin;
        bool posFeeEligible;
        uint64 createdAt;
        uint64 updatedAt;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressWallet();
    error ZeroMerchantId();
    error ZeroPoolId();
    error EmptyName();
    error UnknownPool(bytes32 poolId);
    error UnknownMerchant(bytes32 merchantId);
    error PoolAlreadyExists(bytes32 poolId);
    error MerchantAlreadyExists(bytes32 merchantId);
    error InvalidPoolStatus(bytes32 poolId);
    error InvalidMerchantStatus(bytes32 merchantId);
    error MerchantPoolInactive(bytes32 poolId);
    error WalletAlreadyLinked(address wallet, bytes32 merchantId);
    error WalletNotLinked(bytes32 merchantId, address wallet);
    error Unauthorized();
    error SameAddress();

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);

    event PoolAdded(
        bytes32 indexed poolId,
        string name,
        string metadataRecordId,
        address indexed actor
    );

    event PoolRemoved(bytes32 indexed poolId, address indexed actor);
    event PoolSuspended(bytes32 indexed poolId, address indexed actor);
    event PoolUnsuspended(bytes32 indexed poolId, address indexed actor);

    event MerchantApproved(
        bytes32 indexed merchantId,
        bytes32 indexed poolId,
        string metadataRecordId,
        address indexed actor
    );

    event MerchantRemoved(bytes32 indexed merchantId, bytes32 indexed poolId, address indexed actor);
    event MerchantSuspended(bytes32 indexed merchantId, bytes32 indexed poolId, address indexed actor);
    event MerchantUnsuspended(bytes32 indexed merchantId, bytes32 indexed poolId, address indexed actor);

    event MerchantPoolReassigned(
        bytes32 indexed merchantId,
        bytes32 indexed oldPoolId,
        bytes32 indexed newPoolId,
        address actor
    );

    event MerchantWalletAdded(bytes32 indexed merchantId, address indexed wallet, address indexed actor);
    event MerchantWalletRemoved(bytes32 indexed merchantId, address indexed wallet, address indexed actor);
    event MerchantCplAcceptanceUpdated(bytes32 indexed merchantId, bool acceptsCplTcoin, address indexed actor);
    event MerchantPosFeeEligibilityUpdated(bytes32 indexed merchantId, bool posFeeEligible, address indexed actor);

    address public governance;

    mapping(bytes32 => Pool) private pools;
    bytes32[] private poolIds;
    mapping(bytes32 => bool) private poolExists;

    mapping(bytes32 => MerchantEntity) private merchants;
    mapping(bytes32 => bool) private merchantExists;
    bytes32[] private merchantIds;

    mapping(address => bytes32) private merchantIdByWallet;
    mapping(bytes32 => address[]) private merchantWallets;
    mapping(bytes32 => mapping(address => bool)) private walletLinkedToMerchant;
    mapping(bytes32 => mapping(address => uint256)) private merchantWalletIndex;

    constructor(address initialOwner, address governance_) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
        _setGovernance(governance_);
    }

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    function setGovernance(address governance_) external onlyOwner {
        _setGovernance(governance_);
    }

    function addPool(
        bytes32 poolId,
        string calldata name,
        string calldata metadataRecordId
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (bytes(name).length == 0) revert EmptyName();
        if (poolExists[poolId]) revert PoolAlreadyExists(poolId);

        poolExists[poolId] = true;
        poolIds.push(poolId);

        pools[poolId] = Pool({
            poolId: poolId,
            name: name,
            metadataRecordId: metadataRecordId,
            status: PoolStatus.Active,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        emit PoolAdded(poolId, name, metadataRecordId, msg.sender);
    }

    function removePool(bytes32 poolId) external onlyGovernanceOrOwner {
        Pool storage pool = _getPoolStorage(poolId);
        if (pool.status == PoolStatus.Removed) revert InvalidPoolStatus(poolId);

        pool.status = PoolStatus.Removed;
        pool.updatedAt = uint64(block.timestamp);

        emit PoolRemoved(poolId, msg.sender);
    }

    function suspendPool(bytes32 poolId) external onlyGovernanceOrOwner {
        Pool storage pool = _getPoolStorage(poolId);
        if (pool.status != PoolStatus.Active) revert InvalidPoolStatus(poolId);

        pool.status = PoolStatus.Suspended;
        pool.updatedAt = uint64(block.timestamp);

        emit PoolSuspended(poolId, msg.sender);
    }

    function unsuspendPool(bytes32 poolId) external onlyGovernanceOrOwner whenNotPaused {
        Pool storage pool = _getPoolStorage(poolId);
        if (pool.status != PoolStatus.Suspended) revert InvalidPoolStatus(poolId);

        pool.status = PoolStatus.Active;
        pool.updatedAt = uint64(block.timestamp);

        emit PoolUnsuspended(poolId, msg.sender);
    }

    function approveMerchant(
        bytes32 merchantId,
        bytes32 poolId,
        string calldata metadataRecordId,
        address[] calldata initialWallets
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (merchantId == bytes32(0)) revert ZeroMerchantId();
        if (merchantExists[merchantId]) revert MerchantAlreadyExists(merchantId);
        if (!_isPoolActive(poolId)) revert MerchantPoolInactive(poolId);

        uint64 timestamp = uint64(block.timestamp);
        merchantExists[merchantId] = true;
        merchantIds.push(merchantId);

        merchants[merchantId] = MerchantEntity({
            merchantId: merchantId,
            poolId: poolId,
            metadataRecordId: metadataRecordId,
            status: MerchantStatus.Approved,
            acceptsCplTcoin: true,
            posFeeEligible: true,
            createdAt: timestamp,
            updatedAt: timestamp
        });

        emit MerchantApproved(merchantId, poolId, metadataRecordId, msg.sender);

        for (uint256 i = 0; i < initialWallets.length; ++i) {
            _linkWallet(merchantId, initialWallets[i]);
        }
    }

    function addMerchantWallet(bytes32 merchantId, address wallet) external onlyGovernanceOrOwner whenNotPaused {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        _linkWallet(merchantId, wallet);
        merchantRecord.updatedAt = uint64(block.timestamp);
    }

    function removeMerchantWallet(bytes32 merchantId, address wallet) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);

        _unlinkWallet(merchantId, wallet);
        merchantRecord.updatedAt = uint64(block.timestamp);
    }

    function setMerchantCplAcceptance(bytes32 merchantId, bool acceptsCplTcoin_) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        merchantRecord.acceptsCplTcoin = acceptsCplTcoin_;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantCplAcceptanceUpdated(merchantId, acceptsCplTcoin_, msg.sender);
    }

    function setMerchantPosFeeEligibility(bytes32 merchantId, bool posFeeEligible_) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        merchantRecord.posFeeEligible = posFeeEligible_;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantPosFeeEligibilityUpdated(merchantId, posFeeEligible_, msg.sender);
    }

    function removeMerchant(bytes32 merchantId) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        merchantRecord.status = MerchantStatus.Removed;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantRemoved(merchantId, merchantRecord.poolId, msg.sender);
    }

    function suspendMerchant(bytes32 merchantId) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status != MerchantStatus.Approved) revert InvalidMerchantStatus(merchantId);

        merchantRecord.status = MerchantStatus.Suspended;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantSuspended(merchantId, merchantRecord.poolId, msg.sender);
    }

    function unsuspendMerchant(bytes32 merchantId) external onlyGovernanceOrOwner whenNotPaused {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status != MerchantStatus.Suspended) revert InvalidMerchantStatus(merchantId);

        merchantRecord.status = MerchantStatus.Approved;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantUnsuspended(merchantId, merchantRecord.poolId, msg.sender);
    }

    function reassignMerchantPool(bytes32 merchantId, bytes32 newPoolId) external onlyGovernanceOrOwner whenNotPaused {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);
        if (!_isPoolActive(newPoolId)) revert MerchantPoolInactive(newPoolId);

        bytes32 oldPoolId = merchantRecord.poolId;
        merchantRecord.poolId = newPoolId;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantPoolReassigned(merchantId, oldPoolId, newPoolId, msg.sender);
    }

    function pause() external onlyGovernanceOrOwner {
        _pause();
    }

    function unpause() external onlyGovernanceOrOwner {
        _unpause();
    }

    function getPool(bytes32 poolId) external view returns (Pool memory) {
        return _getPoolStorage(poolId);
    }

    function getMerchant(bytes32 merchantId) external view returns (MerchantEntity memory) {
        return _getMerchantStorage(merchantId);
    }

    function getMerchantIdByWallet(address wallet) external view returns (bytes32) {
        return merchantIdByWallet[wallet];
    }

    function getMerchantWallets(bytes32 merchantId) external view returns (address[] memory) {
        _getMerchantStorage(merchantId);
        return merchantWallets[merchantId];
    }

    function getMerchantPaymentConfig(address wallet)
        external
        view
        returns (
            bool exists_,
            bytes32 merchantId_,
            bool approved_,
            bool poolActive_,
            bool acceptsCpl_,
            bool posFeeEligible_,
            bytes32 poolId_
        )
    {
        merchantId_ = merchantIdByWallet[wallet];
        if (merchantId_ == bytes32(0)) {
            return (false, bytes32(0), false, false, false, false, bytes32(0));
        }

        MerchantEntity storage merchantRecord = merchants[merchantId_];
        approved_ = merchantRecord.status == MerchantStatus.Approved;
        poolActive_ = _isPoolActive(merchantRecord.poolId);
        acceptsCpl_ = merchantRecord.acceptsCplTcoin;
        posFeeEligible_ = merchantRecord.posFeeEligible;
        poolId_ = merchantRecord.poolId;

        return (true, merchantId_, approved_, poolActive_, acceptsCpl_, posFeeEligible_, poolId_);
    }

    function isPoolActive(bytes32 poolId) external view returns (bool) {
        return _isPoolActive(poolId);
    }

    function isMerchantWallet(address wallet) external view returns (bool) {
        return merchantIdByWallet[wallet] != bytes32(0);
    }

    function isMerchantApproved(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        return merchants[merchantId].status == MerchantStatus.Approved;
    }

    function isMerchantApprovedWallet(address wallet) external view returns (bool) {
        return _isMerchantApprovedWallet(wallet);
    }

    function isMerchantApprovedInActivePool(address wallet) external view returns (bool) {
        return _isMerchantApprovedWallet(wallet);
    }

    function isMerchantPaymentTarget(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        MerchantEntity storage merchantRecord = merchants[merchantId];
        if (!_isMerchantApprovedWallet(wallet)) return false;

        return merchantRecord.acceptsCplTcoin;
    }

    function isMerchantPosFeeTarget(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        MerchantEntity storage merchantRecord = merchants[merchantId];
        if (!_isMerchantApprovedWallet(wallet)) return false;

        return merchantRecord.acceptsCplTcoin && merchantRecord.posFeeEligible;
    }

    function acceptsCplTcoin(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        return merchants[merchantId].acceptsCplTcoin;
    }

    function getMerchantPool(address wallet) external view returns (bytes32) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return bytes32(0);

        return merchants[merchantId].poolId;
    }

    function listPoolIds() external view returns (bytes32[] memory) {
        return poolIds;
    }

    function getPoolCount() external view returns (uint256) {
        return poolIds.length;
    }

    function listMerchantIds() external view returns (bytes32[] memory) {
        return merchantIds;
    }

    function getMerchantCount() external view returns (uint256) {
        return merchantIds.length;
    }

    function _getPoolStorage(bytes32 poolId) internal view returns (Pool storage pool) {
        if (!poolExists[poolId]) revert UnknownPool(poolId);
        pool = pools[poolId];
    }

    function _getMerchantStorage(bytes32 merchantId) internal view returns (MerchantEntity storage merchantRecord) {
        if (!merchantExists[merchantId]) revert UnknownMerchant(merchantId);
        merchantRecord = merchants[merchantId];
    }

    function _isMerchantApprovedWallet(address wallet) internal view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        MerchantEntity storage merchantRecord = merchants[merchantId];
        if (merchantRecord.status != MerchantStatus.Approved) return false;

        return _isPoolActive(merchantRecord.poolId);
    }

    function _isPoolActive(bytes32 poolId) internal view returns (bool) {
        if (!poolExists[poolId]) return false;
        return pools[poolId].status == PoolStatus.Active;
    }

    function _linkWallet(bytes32 merchantId, address wallet) internal {
        if (wallet == address(0)) revert ZeroAddressWallet();

        bytes32 existingMerchantId = merchantIdByWallet[wallet];
        if (existingMerchantId != bytes32(0)) revert WalletAlreadyLinked(wallet, existingMerchantId);

        merchantIdByWallet[wallet] = merchantId;
        walletLinkedToMerchant[merchantId][wallet] = true;
        merchantWallets[merchantId].push(wallet);
        merchantWalletIndex[merchantId][wallet] = merchantWallets[merchantId].length;

        emit MerchantWalletAdded(merchantId, wallet, msg.sender);
    }

    function _unlinkWallet(bytes32 merchantId, address wallet) internal {
        if (!walletLinkedToMerchant[merchantId][wallet]) revert WalletNotLinked(merchantId, wallet);

        uint256 indexPlusOne = merchantWalletIndex[merchantId][wallet];
        uint256 walletIndex = indexPlusOne - 1;
        uint256 lastIndex = merchantWallets[merchantId].length - 1;

        if (walletIndex != lastIndex) {
            address movedWallet = merchantWallets[merchantId][lastIndex];
            merchantWallets[merchantId][walletIndex] = movedWallet;
            merchantWalletIndex[merchantId][movedWallet] = walletIndex + 1;
        }

        merchantWallets[merchantId].pop();
        delete merchantWalletIndex[merchantId][wallet];
        delete walletLinkedToMerchant[merchantId][wallet];
        delete merchantIdByWallet[wallet];

        emit MerchantWalletRemoved(merchantId, wallet, msg.sender);
    }

    function _setGovernance(address governance_) internal {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();

        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }
}

```

## ./ReserveRegistry.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

contract ReserveRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable, PausableUpgradeable {
    enum ReserveAssetStatus {
        None,
        Active,
        Paused,
        Removed
    }

    struct ReserveAsset {
        bytes32 assetId;
        address token;
        string code;
        uint8 tokenDecimals;
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
        ReserveAssetStatus status;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressToken();
    error ZeroAssetId();
    error AssetAlreadyExists(bytes32 assetId);
    error TokenAlreadyRegistered(address token);
    error UnknownAsset(bytes32 assetId);
    error UnknownToken(address token);
    error InvalidAssetStatus(bytes32 assetId);
    error InvalidStaleness();
    error ZeroPrimaryOracle();
    error Unauthorized();
    error SameAddress();
    error EmptyCode();

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);

    event ReserveAssetAdded(
        bytes32 indexed assetId,
        address indexed token,
        string code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter
    );

    event ReserveAssetPaused(bytes32 indexed assetId, address indexed actor);
    event ReserveAssetUnpaused(bytes32 indexed assetId, address indexed actor);
    event ReserveAssetRemoved(bytes32 indexed assetId, address indexed actor);

    event ReserveAssetOracleUpdated(
        bytes32 indexed assetId,
        address indexed primaryOracle,
        address indexed fallbackOracle
    );

    event ReserveAssetStalenessUpdated(
        bytes32 indexed assetId,
        uint256 oldStaleAfter,
        uint256 newStaleAfter
    );

    event ReserveAssetCodeUpdated(bytes32 indexed assetId, string oldCode, string newCode);

    address public governance;

    mapping(bytes32 => ReserveAsset) private reserveAssets;
    mapping(address => bytes32) private assetIdByToken;
    bytes32[] private reserveAssetIds;
    mapping(bytes32 => bool) private assetExists;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    function initialize(address owner_, address governance_) external initializer {
        if (owner_ == address(0)) revert ZeroAddressOwner();
        if (governance_ == address(0)) revert ZeroAddressGovernance();

        __Ownable_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        _transferOwnership(owner_);

        governance = governance_;
        emit GovernanceUpdated(address(0), governance_);
    }

    function setGovernance(address governance_) external onlyOwner {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();

        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }

    function addReserveAsset(
        bytes32 assetId,
        address token,
        string calldata code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (assetId == bytes32(0)) revert ZeroAssetId();
        if (token == address(0)) revert ZeroAddressToken();
        if (bytes(code).length == 0) revert EmptyCode();
        if (primaryOracle == address(0)) revert ZeroPrimaryOracle();
        if (staleAfter == 0) revert InvalidStaleness();
        if (assetExists[assetId]) revert AssetAlreadyExists(assetId);
        if (assetIdByToken[token] != bytes32(0)) revert TokenAlreadyRegistered(token);

        reserveAssets[assetId] = ReserveAsset({
            assetId: assetId,
            token: token,
            code: code,
            tokenDecimals: tokenDecimals,
            primaryOracle: primaryOracle,
            fallbackOracle: fallbackOracle,
            staleAfter: staleAfter,
            status: ReserveAssetStatus.Active
        });

        assetExists[assetId] = true;
        assetIdByToken[token] = assetId;
        reserveAssetIds.push(assetId);

        emit ReserveAssetAdded(
            assetId,
            token,
            code,
            tokenDecimals,
            primaryOracle,
            fallbackOracle,
            staleAfter
        );
    }

    function pauseReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status != ReserveAssetStatus.Active) revert InvalidAssetStatus(assetId);

        asset.status = ReserveAssetStatus.Paused;
        emit ReserveAssetPaused(assetId, msg.sender);
    }

    function unpauseReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner whenNotPaused {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status != ReserveAssetStatus.Paused) revert InvalidAssetStatus(assetId);

        asset.status = ReserveAssetStatus.Active;
        emit ReserveAssetUnpaused(assetId, msg.sender);
    }

    function removeReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);

        asset.status = ReserveAssetStatus.Removed;
        emit ReserveAssetRemoved(assetId, msg.sender);
    }

    function updateReserveAssetOracles(
        bytes32 assetId,
        address primaryOracle,
        address fallbackOracle
    ) external onlyGovernanceOrOwner whenNotPaused {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);
        if (primaryOracle == address(0)) revert ZeroPrimaryOracle();

        asset.primaryOracle = primaryOracle;
        asset.fallbackOracle = fallbackOracle;

        emit ReserveAssetOracleUpdated(assetId, primaryOracle, fallbackOracle);
    }

    function updateReserveAssetStaleness(
        bytes32 assetId,
        uint256 staleAfter
    ) external onlyGovernanceOrOwner whenNotPaused {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);
        if (staleAfter == 0) revert InvalidStaleness();

        uint256 oldStaleAfter = asset.staleAfter;
        asset.staleAfter = staleAfter;

        emit ReserveAssetStalenessUpdated(assetId, oldStaleAfter, staleAfter);
    }

    function updateReserveAssetCode(
        bytes32 assetId,
        string calldata newCode
    ) external onlyGovernanceOrOwner whenNotPaused {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        if (asset.status == ReserveAssetStatus.Removed) revert InvalidAssetStatus(assetId);
        if (bytes(newCode).length == 0) revert EmptyCode();

        string memory oldCode = asset.code;
        asset.code = newCode;

        emit ReserveAssetCodeUpdated(assetId, oldCode, newCode);
    }

    function pause() external onlyGovernanceOrOwner {
        _pause();
    }

    function unpause() external onlyGovernanceOrOwner {
        _unpause();
    }

    function getReserveAsset(bytes32 assetId) external view returns (ReserveAsset memory) {
        return _getReserveAssetStorage(assetId);
    }

    function getReserveAssetByToken(address token) external view returns (ReserveAsset memory) {
        bytes32 assetId = assetIdByToken[token];
        if (assetId == bytes32(0)) revert UnknownToken(token);
        return reserveAssets[assetId];
    }

    function getAssetIdByToken(address token) external view returns (bytes32) {
        return assetIdByToken[token];
    }

    function reserveAssetExists(bytes32 assetId) external view returns (bool) {
        return assetExists[assetId];
    }

    function isReserveAssetActive(bytes32 assetId) external view returns (bool) {
        if (!assetExists[assetId]) return false;
        return reserveAssets[assetId].status == ReserveAssetStatus.Active;
    }

    function listReserveAssetIds() external view returns (bytes32[] memory) {
        return reserveAssetIds;
    }

    function reserveAssetCount() external view returns (uint256) {
        return reserveAssetIds.length;
    }

    function getOracleConfig(bytes32 assetId)
        external
        view
        returns (
            address token,
            uint8 tokenDecimals,
            address primaryOracle,
            address fallbackOracle,
            uint256 staleAfter
        )
    {
        ReserveAsset storage asset = _getReserveAssetStorage(assetId);
        return (
            asset.token,
            asset.tokenDecimals,
            asset.primaryOracle,
            asset.fallbackOracle,
            asset.staleAfter
        );
    }

    function _getReserveAssetStorage(bytes32 assetId) internal view returns (ReserveAsset storage asset) {
        if (!assetExists[assetId]) revert UnknownAsset(assetId);
        asset = reserveAssets[assetId];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

```

## ./StewardRegistry.sol

```bash sol
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

```

## ./TcoinMintRouter.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";
import {ITreasuryMinting} from "./interfaces/ITreasuryMinting.sol";

contract TcoinMintRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error DeadlineExpired();
    error InvalidAddress();
    error InvalidAssetId();
    error InputTokenNotEnabled(address token);
    error InvalidAmount();
    error SwapReturnedInsufficientCadm(uint256 expectedMin, uint256 actual);
    error TreasuryMintReturnedInsufficientTcoin(uint256 expectedMin, uint256 actual);
    error RecipientZeroAddress();

    event SwapAdapterUpdated(address indexed oldSwapAdapter, address indexed newSwapAdapter, address indexed actor);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury, address indexed actor);
    event CadmConfigUpdated(
        address indexed oldCadmToken,
        address indexed newCadmToken,
        bytes32 oldCadmAssetId,
        bytes32 newCadmAssetId,
        address actor
    );
    event InputTokenStatusUpdated(address indexed token, bool enabled, address indexed actor);
    event UsdcTokenUpdated(address indexed oldUsdcToken, address indexed newUsdcToken, address indexed actor);

    event MintTcoinWithTokenExecuted(
        address indexed caller,
        address indexed recipient,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 cadmOut,
        uint256 tcoinOut,
        uint256 requestedCharityId
    );

    event RefundIssued(address indexed token, address indexed to, uint256 amount);

    address public swapAdapter;
    address public treasury;
    address public cadmToken;
    bytes32 public cadmAssetId;
    mapping(address => bool) public enabledInputToken;
    address public usdcToken;

    constructor(
        address initialOwner,
        address swapAdapter_,
        address treasury_,
        address cadmToken_,
        bytes32 cadmAssetId_,
        address usdcToken_
    ) {
        if (initialOwner == address(0)) revert InvalidAddress();
        _transferOwnership(initialOwner);

        _setSwapAdapter(swapAdapter_);
        _setTreasury(treasury_);
        _setCadmConfig(cadmToken_, cadmAssetId_);
        _setUsdcToken(usdcToken_);
    }

    function mintTcoinWithToken(
        address tokenIn,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 minTcoinOut,
        uint256 deadline,
        address recipient,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) external nonReentrant whenNotPaused returns (uint256 tcoinOut) {
        return
            _mintTcoinWithToken(
                tokenIn,
                amountIn,
                minCadmOut,
                minTcoinOut,
                deadline,
                recipient,
                requestedCharityId,
                swapData
            );
    }

    function mintTcoinWithUSDC(
        uint256 usdcAmountIn,
        uint256 minCadmOut,
        uint256 minTcoinOut,
        uint256 deadline,
        address recipient,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) external nonReentrant whenNotPaused returns (uint256 tcoinOut) {
        return
            _mintTcoinWithToken(
                usdcToken,
                usdcAmountIn,
                minCadmOut,
                minTcoinOut,
                deadline,
                recipient,
                requestedCharityId,
                swapData
            );
    }

    function _mintTcoinWithToken(
        address tokenIn,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 minTcoinOut,
        uint256 deadline,
        address recipient,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) internal returns (uint256 tcoinOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (amountIn == 0) revert InvalidAmount();
        if (recipient == address(0)) revert RecipientZeroAddress();
        if (!enabledInputToken[tokenIn]) revert InputTokenNotEnabled(tokenIn);

        uint256 initialTokenInBalance = IERC20(tokenIn).balanceOf(address(this));
        uint256 initialCadmBalance = IERC20(cadmToken).balanceOf(address(this));

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 cadmOut = _swapToCadm(tokenIn, amountIn, minCadmOut, deadline, swapData);

        tcoinOut = _mintTcoinFromCadm(cadmOut, minTcoinOut, requestedCharityId);
        IERC20(ITreasuryMinting(treasury).tcoinToken()).safeTransfer(recipient, tcoinOut);

        _refundSurplus(tokenIn, msg.sender, initialTokenInBalance);
        if (tokenIn != cadmToken) {
            _refundSurplus(cadmToken, msg.sender, initialCadmBalance);
        }

        emit MintTcoinWithTokenExecuted(msg.sender, recipient, tokenIn, amountIn, cadmOut, tcoinOut, requestedCharityId);
    }

    function previewMintTcoinWithToken(
        address tokenIn,
        uint256 amountIn,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) external view returns (uint256 cadmOut, uint256 tcoinOut) {
        if (!enabledInputToken[tokenIn]) revert InputTokenNotEnabled(tokenIn);
        if (amountIn == 0) revert InvalidAmount();

        if (tokenIn == cadmToken) {
            cadmOut = amountIn;
        } else {
            cadmOut = ISwapAdapter(swapAdapter).previewSwapToCadm(tokenIn, cadmToken, amountIn, swapData);
        }

        (tcoinOut,,,,) = ITreasuryMinting(treasury).previewMint(cadmAssetId, cadmOut, requestedCharityId);
    }

    function setSwapAdapter(address swapAdapter_) external onlyOwner {
        _setSwapAdapter(swapAdapter_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function setCadmConfig(address cadmToken_, bytes32 cadmAssetId_) external onlyOwner {
        _setCadmConfig(cadmToken_, cadmAssetId_);
    }

    function setInputTokenEnabled(address token, bool enabled) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        enabledInputToken[token] = enabled;
        emit InputTokenStatusUpdated(token, enabled, msg.sender);
    }

    function setUsdcToken(address usdcToken_) external onlyOwner {
        _setUsdcToken(usdcToken_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _swapToCadm(
        address tokenIn,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 deadline,
        bytes calldata swapData
    ) internal returns (uint256 cadmOut) {
        if (tokenIn == cadmToken) {
            cadmOut = amountIn;
        } else {
            uint256 cadmBefore = IERC20(cadmToken).balanceOf(address(this));
            _approveExact(tokenIn, swapAdapter, amountIn);

            ISwapAdapter(swapAdapter).swapToCadm(tokenIn, cadmToken, amountIn, minCadmOut, deadline, swapData);

            uint256 cadmAfter = IERC20(cadmToken).balanceOf(address(this));
            cadmOut = cadmAfter - cadmBefore;
        }

        if (cadmOut < minCadmOut) {
            revert SwapReturnedInsufficientCadm(minCadmOut, cadmOut);
        }
    }

    function _mintTcoinFromCadm(
        uint256 cadmOut,
        uint256 minTcoinOut,
        uint256 requestedCharityId
    ) internal returns (uint256 tcoinOut) {
        address tcoin = ITreasuryMinting(treasury).tcoinToken();
        address treasuryVault = ITreasuryMinting(treasury).treasury();
        if (tcoin == address(0)) revert InvalidAddress();
        if (treasuryVault == address(0)) revert InvalidAddress();

        uint256 tcoinBefore = IERC20(tcoin).balanceOf(address(this));
        _approveExact(cadmToken, treasuryVault, cadmOut);

        ITreasuryMinting(treasury).depositAndMint(
            cadmAssetId,
            cadmOut,
            requestedCharityId,
            minTcoinOut
        );

        uint256 tcoinAfter = IERC20(tcoin).balanceOf(address(this));
        uint256 mintedByBalance = tcoinAfter - tcoinBefore;

        tcoinOut = mintedByBalance;

        if (tcoinOut < minTcoinOut) {
            revert TreasuryMintReturnedInsufficientTcoin(minTcoinOut, tcoinOut);
        }
    }

    function _approveExact(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        erc20.safeApprove(spender, 0);
        erc20.safeApprove(spender, amount);
    }

    function _refundSurplus(address token, address to, uint256 initialBalance) internal {
        uint256 current = IERC20(token).balanceOf(address(this));
        if (current <= initialBalance) return;

        uint256 refundAmount = current - initialBalance;
        IERC20(token).safeTransfer(to, refundAmount);
        emit RefundIssued(token, to, refundAmount);
    }

    function _setSwapAdapter(address swapAdapter_) internal {
        if (swapAdapter_ == address(0)) revert InvalidAddress();
        address oldSwapAdapter = swapAdapter;
        swapAdapter = swapAdapter_;
        emit SwapAdapterUpdated(oldSwapAdapter, swapAdapter_, msg.sender);
    }

    function _setTreasury(address treasury_) internal {
        if (treasury_ == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = treasury_;
        emit TreasuryUpdated(oldTreasury, treasury_, msg.sender);
    }

    function _setCadmConfig(address cadmToken_, bytes32 cadmAssetId_) internal {
        if (cadmToken_ == address(0)) revert InvalidAddress();
        if (cadmAssetId_ == bytes32(0)) revert InvalidAssetId();

        address oldCadmToken = cadmToken;
        bytes32 oldCadmAssetId = cadmAssetId;

        cadmToken = cadmToken_;
        cadmAssetId = cadmAssetId_;

        emit CadmConfigUpdated(oldCadmToken, cadmToken_, oldCadmAssetId, cadmAssetId_, msg.sender);
    }

    function _setUsdcToken(address usdcToken_) internal {
        if (usdcToken_ == address(0)) revert InvalidAddress();
        address oldUsdcToken = usdcToken;
        usdcToken = usdcToken_;
        emit UsdcTokenUpdated(oldUsdcToken, usdcToken_, msg.sender);
    }
}

```

## ./Treasury.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    using SafeERC20 for IERC20;

    error ZeroAddressOwner();
    error ZeroAddressToken();
    error ZeroAddressTarget();
    error ZeroAddressCaller();
    error ZeroAmount();
    error Unauthorized();
    error InsufficientReserveBalance(address token, uint256 requested, uint256 available);
    error SameAuthorizationState(address caller, bool authorized);

    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ReserveDeposited(address indexed actor, address indexed from, address indexed token, uint256 amount);
    event ReserveWithdrawn(address indexed actor, address indexed to, address indexed token, uint256 amount);
    event EmergencySweep(address indexed actor, address indexed token, address indexed to, uint256 amount);

    mapping(address => bool) public authorizedCallers;

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
    }

    modifier onlyAuthorizedCaller() {
        if (!authorizedCallers[msg.sender]) revert Unauthorized();
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert ZeroAddressCaller();
        if (authorizedCallers[caller] == authorized) revert SameAuthorizationState(caller, authorized);

        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function depositReserveFrom(address from, address token, uint256 amount)
        external
        onlyAuthorizedCaller
        returns (bool)
    {
        if (from == address(0)) revert ZeroAddressTarget();
        if (token == address(0)) revert ZeroAddressToken();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(from, address(this), amount);
        emit ReserveDeposited(msg.sender, from, token, amount);
        return true;
    }

    function withdrawReserveTo(address to, address token, uint256 amount) external onlyAuthorizedCaller returns (bool) {
        if (to == address(0)) revert ZeroAddressTarget();
        if (token == address(0)) revert ZeroAddressToken();
        if (amount == 0) revert ZeroAmount();

        uint256 available = IERC20(token).balanceOf(address(this));
        if (available < amount) revert InsufficientReserveBalance(token, amount, available);

        IERC20(token).safeTransfer(to, amount);
        emit ReserveWithdrawn(msg.sender, to, token, amount);
        return true;
    }

    function reserveBalance(address token) external view returns (uint256) {
        if (token == address(0)) revert ZeroAddressToken();
        return IERC20(token).balanceOf(address(this));
    }

    function emergencySweep(address token, address to, uint256 amount) external onlyOwner returns (bool) {
        if (token == address(0)) revert ZeroAddressToken();
        if (to == address(0)) revert ZeroAddressTarget();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
        emit EmergencySweep(msg.sender, token, to, amount);
        return true;
    }
}

```

## ./TreasuryController.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICharityRegistry} from "./interfaces/ICharityRegistry.sol";
import {IOracleRouter} from "./interfaces/IOracleRouter.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {IReserveRegistry} from "./interfaces/IReserveRegistry.sol";
import {ITCOINToken} from "./interfaces/ITCOINToken.sol";

contract TreasuryController is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant CAD_PEG_MAX_DELTA_BPS = 1_000; // 10%
    uint256 public constant VALUE_SCALE = 1e18;

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressIndexer();
    error ZeroAddressToken();
    error ZeroAddressRegistry();
    error ZeroAmount();
    error MintingPaused();
    error RedemptionPaused();
    error AssetPaused(bytes32 assetId);
    error AssetInactive(bytes32 assetId);
    error UnknownAsset(bytes32 assetId);
    error InsufficientReserveBalance(bytes32 assetId, uint256 requested, uint256 available);
    error InvalidRedeemRate();
    error InvalidCharityMintRate();
    error InvalidCadPeg();
    error MerchantNotEligible(address merchant);
    error MerchantAllowanceExceeded(address merchant, uint256 requested, uint256 available);
    error InvalidMinOut(uint256 actualOut, uint256 minOut);
    error Unauthorized();
    error SameAddress();
    error InvalidPegChange(uint256 oldPeg18, uint256 newPeg18);
    error InvalidCharityResolution(uint256 charityId);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event IndexerUpdated(address indexed oldIndexer, address indexed newIndexer);
    event TcoinTokenUpdated(address indexed oldToken, address indexed newToken);
    event ReserveRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event OracleRouterUpdated(address indexed oldRouter, address indexed newRouter);

    event ReserveDeposited(
        address indexed depositor,
        bytes32 indexed assetId,
        uint256 assetAmount,
        uint256 cadValue18,
        uint256 userTcoinMinted,
        uint256 charityTcoinMinted,
        uint256 indexed charityId,
        bool usedFallbackOracle
    );

    event LiquidityRouteDeposited(
        address indexed router,
        address indexed payer,
        bytes32 indexed assetId,
        uint256 assetAmount,
        uint256 cadValue18,
        uint256 mrTcoinOut,
        bool usedFallbackOracle
    );

    event RedeemedAsUser(
        address indexed user,
        bytes32 indexed assetId,
        uint256 tcoinBurned,
        uint256 assetOut,
        uint256 grossCad18,
        uint256 redeemableCad18,
        bool usedFallbackOracle
    );

    event RedeemedAsMerchant(
        address indexed merchant,
        bytes32 indexed assetId,
        uint256 tcoinBurned,
        uint256 assetOut,
        uint256 grossCad18,
        uint256 redeemableCad18,
        uint256 allowanceRemaining,
        bool usedFallbackOracle
    );

    event MerchantAllowanceUpdated(address indexed merchant, uint256 oldAmount, uint256 newAmount, address indexed actor);

    event CadPegUpdated(uint256 oldPeg18, uint256 newPeg18);
    event UserRedeemRateUpdated(uint256 oldRateBps, uint256 newRateBps);
    event MerchantRedeemRateUpdated(uint256 oldRateBps, uint256 newRateBps);
    event CharityMintRateUpdated(uint256 oldRateBps, uint256 newRateBps);

    event MintingPauseUpdated(bool paused, address indexed actor);
    event RedemptionPauseUpdated(bool paused, address indexed actor);
    event TreasuryAssetPauseUpdated(bytes32 indexed assetId, bool paused, address indexed actor);

    address public governance;
    address public indexer;
    address public tcoinToken;
    address public reserveRegistry;
    address public charityRegistry;
    address public poolRegistry;
    address public oracleRouter;

    uint256 public cadPeg18;
    uint256 public userRedeemRateBps;
    uint256 public merchantRedeemRateBps;
    uint256 public charityMintRateBps;

    bool public mintingPaused;
    bool public redemptionPaused;

    mapping(bytes32 => bool) public assetTreasuryPaused;
    mapping(address => uint256) private merchantRedemptionAllowance;

    mapping(bytes32 => uint256) public totalDepositedByAsset;
    mapping(bytes32 => uint256) public totalRedeemedByAsset;
    uint256 public totalTcoinMintedViaDeposits;
    uint256 public totalTcoinBurnedViaRedemption;
    uint256 public totalCharityTcoinMinted;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier onlyIndexerOrOwner() {
        if (msg.sender != indexer && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier whenMintingNotPaused() {
        if (mintingPaused) revert MintingPaused();
        _;
    }

    modifier whenRedemptionNotPaused() {
        if (redemptionPaused) revert RedemptionPaused();
        _;
    }

    function initialize(
        address owner_,
        address governance_,
        address indexer_,
        address tcoinToken_,
        address reserveRegistry_,
        address charityRegistry_,
        address poolRegistry_,
        address oracleRouter_,
        uint256 cadPeg18_,
        uint256 userRedeemRateBps_,
        uint256 merchantRedeemRateBps_,
        uint256 charityMintRateBps_
    ) external initializer {
        if (owner_ == address(0)) revert ZeroAddressOwner();
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (indexer_ == address(0)) revert ZeroAddressIndexer();
        if (tcoinToken_ == address(0)) revert ZeroAddressToken();
        if (
            reserveRegistry_ == address(0) || charityRegistry_ == address(0) || poolRegistry_ == address(0)
                || oracleRouter_ == address(0)
        ) {
            revert ZeroAddressRegistry();
        }

        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);

        governance = governance_;
        indexer = indexer_;
        tcoinToken = tcoinToken_;
        reserveRegistry = reserveRegistry_;
        charityRegistry = charityRegistry_;
        poolRegistry = poolRegistry_;
        oracleRouter = oracleRouter_;

        emit GovernanceUpdated(address(0), governance_);
        emit IndexerUpdated(address(0), indexer_);
        emit TcoinTokenUpdated(address(0), tcoinToken_);
        emit ReserveRegistryUpdated(address(0), reserveRegistry_);
        emit CharityRegistryUpdated(address(0), charityRegistry_);
        emit PoolRegistryUpdated(address(0), poolRegistry_);
        emit OracleRouterUpdated(address(0), oracleRouter_);

        _setCadPeg(cadPeg18_, true);
        _setUserRedeemRate(userRedeemRateBps_);
        _setMerchantRedeemRate(merchantRedeemRateBps_);
        _setCharityMintRate(charityMintRateBps_);
    }

    function setGovernance(address governance_) external onlyOwner {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();
        address old = governance;
        governance = governance_;
        emit GovernanceUpdated(old, governance_);
    }

    function setIndexer(address indexer_) external onlyOwner {
        if (indexer_ == address(0)) revert ZeroAddressIndexer();
        if (indexer_ == indexer) revert SameAddress();
        address old = indexer;
        indexer = indexer_;
        emit IndexerUpdated(old, indexer_);
    }

    function setTcoinToken(address tcoinToken_) external onlyOwner {
        if (tcoinToken_ == address(0)) revert ZeroAddressToken();
        if (tcoinToken_ == tcoinToken) revert SameAddress();
        address old = tcoinToken;
        tcoinToken = tcoinToken_;
        emit TcoinTokenUpdated(old, tcoinToken_);
    }

    function setReserveRegistry(address reserveRegistry_) external onlyOwner {
        if (reserveRegistry_ == address(0)) revert ZeroAddressRegistry();
        if (reserveRegistry_ == reserveRegistry) revert SameAddress();
        address old = reserveRegistry;
        reserveRegistry = reserveRegistry_;
        emit ReserveRegistryUpdated(old, reserveRegistry_);
    }

    function setCharityRegistry(address charityRegistry_) external onlyOwner {
        if (charityRegistry_ == address(0)) revert ZeroAddressRegistry();
        if (charityRegistry_ == charityRegistry) revert SameAddress();
        address old = charityRegistry;
        charityRegistry = charityRegistry_;
        emit CharityRegistryUpdated(old, charityRegistry_);
    }

    function setPoolRegistry(address poolRegistry_) external onlyOwner {
        if (poolRegistry_ == address(0)) revert ZeroAddressRegistry();
        if (poolRegistry_ == poolRegistry) revert SameAddress();
        address old = poolRegistry;
        poolRegistry = poolRegistry_;
        emit PoolRegistryUpdated(old, poolRegistry_);
    }

    function setOracleRouter(address oracleRouter_) external onlyOwner {
        if (oracleRouter_ == address(0)) revert ZeroAddressRegistry();
        if (oracleRouter_ == oracleRouter) revert SameAddress();
        address old = oracleRouter;
        oracleRouter = oracleRouter_;
        emit OracleRouterUpdated(old, oracleRouter_);
    }

    function depositAndMint(
        bytes32 assetId,
        uint256 assetAmount,
        uint256 requestedCharityId,
        uint256 minTcoinOut
    ) external nonReentrant whenMintingNotPaused returns (uint256 userTcoinOut, uint256 charityTcoinOut) {
        if (assetAmount == 0) revert ZeroAmount();

        IReserveRegistry.ReserveAsset memory asset = _resolveActiveAsset(assetId);
        (uint256 cadValue18,, bool usedFallbackOracle) = IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);

        userTcoinOut = _tcoinFromCad(cadValue18);
        if (userTcoinOut < minTcoinOut) revert InvalidMinOut(userTcoinOut, minTcoinOut);

        (uint256 resolvedCharityId, address charityWallet) = _resolveMintCharity(requestedCharityId);
        charityTcoinOut = (userTcoinOut * charityMintRateBps) / BPS_DENOMINATOR;

        IERC20(asset.token).safeTransferFrom(msg.sender, address(this), assetAmount);
        ITCOINToken(tcoinToken).mint(msg.sender, userTcoinOut, "");
        if (charityTcoinOut > 0) {
            ITCOINToken(tcoinToken).mint(charityWallet, charityTcoinOut, "");
        }

        totalDepositedByAsset[assetId] += assetAmount;
        totalTcoinMintedViaDeposits += userTcoinOut;
        totalCharityTcoinMinted += charityTcoinOut;

        emit ReserveDeposited(
            msg.sender,
            assetId,
            assetAmount,
            cadValue18,
            userTcoinOut,
            charityTcoinOut,
            resolvedCharityId,
            usedFallbackOracle
        );
    }

    function previewMint(
        bytes32 assetId,
        uint256 assetAmount,
        uint256 requestedCharityId
    )
        external
        view
        returns (
            uint256 userTcoinOut,
            uint256 charityTcoinOut,
            uint256 resolvedCharityId,
            bool usedFallbackOracle,
            uint256 cadValue18
        )
    {
        if (assetAmount == 0) revert ZeroAmount();
        _resolveActiveAsset(assetId);

        (cadValue18,, usedFallbackOracle) = IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);
        userTcoinOut = _tcoinFromCad(cadValue18);
        charityTcoinOut = (userTcoinOut * charityMintRateBps) / BPS_DENOMINATOR;
        (resolvedCharityId,) = _resolveMintCharity(requestedCharityId);
    }

    function depositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount, address payer)
        external
        nonReentrant
        whenMintingNotPaused
        returns (uint256 mrTcoinOut)
    {
        if (assetAmount == 0) revert ZeroAmount();

        IReserveRegistry.ReserveAsset memory asset = _resolveActiveAsset(assetId);
        (uint256 cadValue18,, bool usedFallbackOracle) = IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);

        mrTcoinOut = _tcoinFromCad(cadValue18);

        IERC20(asset.token).safeTransferFrom(msg.sender, address(this), assetAmount);

        totalDepositedByAsset[assetId] += assetAmount;

        emit LiquidityRouteDeposited(msg.sender, payer, assetId, assetAmount, cadValue18, mrTcoinOut, usedFallbackOracle);
    }

    function previewDepositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, uint256 cadValue18, bool usedFallbackOracle)
    {
        if (assetAmount == 0) revert ZeroAmount();
        _resolveActiveAsset(assetId);

        (cadValue18,, usedFallbackOracle) = IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);
        mrTcoinOut = _tcoinFromCad(cadValue18);
    }

    function previewLiquidityRouteDeposit(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, bool usedFallbackOracle, uint256 cadValue18)
    {
        (mrTcoinOut, cadValue18, usedFallbackOracle) = this.previewDepositAssetForLiquidityRoute(assetId, assetAmount);
    }

    function getReserveAssetToken(bytes32 assetId) external view returns (address token) {
        token = _resolveActiveAsset(assetId).token;
    }

    function redeemAsUser(
        bytes32 assetId,
        uint256 tcoinAmount,
        uint256 minAssetOut
    ) external nonReentrant whenRedemptionNotPaused returns (uint256 assetOut) {
        if (tcoinAmount == 0) revert ZeroAmount();

        bool usedFallbackOracle;
        uint256 grossCad18;
        uint256 redeemableCad18;
        (assetOut, usedFallbackOracle, grossCad18, redeemableCad18) = _previewRedeem(assetId, tcoinAmount, userRedeemRateBps);

        if (assetOut < minAssetOut) revert InvalidMinOut(assetOut, minAssetOut);
        _ensureSufficientReserve(assetId, assetOut);

        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        IERC20(tcoinToken).safeTransferFrom(msg.sender, address(this), tcoinAmount);
        ITCOINToken(tcoinToken).burn(tcoinAmount);
        IERC20(asset.token).safeTransfer(msg.sender, assetOut);

        totalRedeemedByAsset[assetId] += assetOut;
        totalTcoinBurnedViaRedemption += tcoinAmount;

        emit RedeemedAsUser(msg.sender, assetId, tcoinAmount, assetOut, grossCad18, redeemableCad18, usedFallbackOracle);
    }

    function redeemAsMerchant(
        bytes32 assetId,
        uint256 tcoinAmount,
        uint256 minAssetOut
    ) external nonReentrant whenRedemptionNotPaused returns (uint256 assetOut) {
        if (tcoinAmount == 0) revert ZeroAmount();
        if (!IPoolRegistry(poolRegistry).isMerchantApprovedInActivePool(msg.sender)) {
            revert MerchantNotEligible(msg.sender);
        }

        uint256 allowanceAvailable = merchantRedemptionAllowance[msg.sender];
        if (allowanceAvailable < tcoinAmount) {
            revert MerchantAllowanceExceeded(msg.sender, tcoinAmount, allowanceAvailable);
        }

        bool usedFallbackOracle;
        uint256 grossCad18;
        uint256 redeemableCad18;
        (assetOut, usedFallbackOracle, grossCad18, redeemableCad18) =
            _previewRedeem(assetId, tcoinAmount, merchantRedeemRateBps);

        if (assetOut < minAssetOut) revert InvalidMinOut(assetOut, minAssetOut);
        _ensureSufficientReserve(assetId, assetOut);

        merchantRedemptionAllowance[msg.sender] = allowanceAvailable - tcoinAmount;

        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        IERC20(tcoinToken).safeTransferFrom(msg.sender, address(this), tcoinAmount);
        ITCOINToken(tcoinToken).burn(tcoinAmount);
        IERC20(asset.token).safeTransfer(msg.sender, assetOut);

        totalRedeemedByAsset[assetId] += assetOut;
        totalTcoinBurnedViaRedemption += tcoinAmount;

        emit MerchantAllowanceUpdated(msg.sender, allowanceAvailable, allowanceAvailable - tcoinAmount, address(this));
        emit RedeemedAsMerchant(
            msg.sender,
            assetId,
            tcoinAmount,
            assetOut,
            grossCad18,
            redeemableCad18,
            merchantRedemptionAllowance[msg.sender],
            usedFallbackOracle
        );
    }

    function previewRedeemAsUser(bytes32 assetId, uint256 tcoinAmount)
        external
        view
        returns (uint256 assetOut, bool usedFallbackOracle, uint256 grossCad18, uint256 redeemableCad18)
    {
        if (tcoinAmount == 0) revert ZeroAmount();
        return _previewRedeem(assetId, tcoinAmount, userRedeemRateBps);
    }

    function previewRedeemAsMerchant(bytes32 assetId, uint256 tcoinAmount, address merchant)
        external
        view
        returns (
            uint256 assetOut,
            bool eligible,
            uint256 allowanceRemaining,
            bool usedFallbackOracle,
            uint256 grossCad18,
            uint256 redeemableCad18
        )
    {
        if (tcoinAmount == 0) revert ZeroAmount();
        eligible = IPoolRegistry(poolRegistry).isMerchantApprovedInActivePool(merchant);
        allowanceRemaining = merchantRedemptionAllowance[merchant];
        (assetOut, usedFallbackOracle, grossCad18, redeemableCad18) = _previewRedeem(assetId, tcoinAmount, merchantRedeemRateBps);
    }

    function setMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        uint256 oldAmount = merchantRedemptionAllowance[merchant];
        merchantRedemptionAllowance[merchant] = amount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, amount, msg.sender);
    }

    function increaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 oldAmount = merchantRedemptionAllowance[merchant];
        uint256 newAmount = oldAmount + amount;
        merchantRedemptionAllowance[merchant] = newAmount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, newAmount, msg.sender);
    }

    function decreaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 oldAmount = merchantRedemptionAllowance[merchant];
        uint256 newAmount = amount >= oldAmount ? 0 : oldAmount - amount;
        merchantRedemptionAllowance[merchant] = newAmount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, newAmount, msg.sender);
    }

    function getMerchantRedemptionAllowance(address merchant) external view returns (uint256) {
        return merchantRedemptionAllowance[merchant];
    }

    function setCadPeg(uint256 newCadPeg18) external onlyGovernanceOrOwner {
        _setCadPeg(newCadPeg18, false);
    }

    function setUserRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        _setUserRedeemRate(newRateBps);
    }

    function setMerchantRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        _setMerchantRedeemRate(newRateBps);
    }

    function setCharityMintRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        _setCharityMintRate(newRateBps);
    }

    function pauseMinting() external onlyGovernanceOrOwner {
        mintingPaused = true;
        emit MintingPauseUpdated(true, msg.sender);
    }

    function unpauseMinting() external onlyGovernanceOrOwner {
        mintingPaused = false;
        emit MintingPauseUpdated(false, msg.sender);
    }

    function pauseRedemption() external onlyGovernanceOrOwner {
        redemptionPaused = true;
        emit RedemptionPauseUpdated(true, msg.sender);
    }

    function unpauseRedemption() external onlyGovernanceOrOwner {
        redemptionPaused = false;
        emit RedemptionPauseUpdated(false, msg.sender);
    }

    function pauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner {
        assetTreasuryPaused[assetId] = true;
        emit TreasuryAssetPauseUpdated(assetId, true, msg.sender);
    }

    function unpauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner {
        assetTreasuryPaused[assetId] = false;
        emit TreasuryAssetPauseUpdated(assetId, false, msg.sender);
    }

    function isMintingPaused() external view returns (bool) {
        return mintingPaused;
    }

    function isRedemptionPaused() external view returns (bool) {
        return redemptionPaused;
    }

    function isTreasuryAssetPaused(bytes32 assetId) external view returns (bool) {
        return assetTreasuryPaused[assetId];
    }

    function getCadPeg() external view returns (uint256) {
        return cadPeg18;
    }

    function getUserRedeemRate() external view returns (uint256) {
        return userRedeemRateBps;
    }

    function getMerchantRedeemRate() external view returns (uint256) {
        return merchantRedeemRateBps;
    }

    function getCharityMintRate() external view returns (uint256) {
        return charityMintRateBps;
    }

    function _resolveActiveAsset(bytes32 assetId)
        internal
        view
        returns (IReserveRegistry.ReserveAsset memory asset)
    {
        asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        if (asset.assetId == bytes32(0)) revert UnknownAsset(assetId);
        if (asset.status != IReserveRegistry.ReserveAssetStatus.Active) revert AssetInactive(assetId);
        if (assetTreasuryPaused[assetId]) revert AssetPaused(assetId);
    }

    function _resolveMintCharity(uint256 requestedCharityId) internal view returns (uint256 charityId, address charityWallet) {
        ICharityRegistry registry = ICharityRegistry(charityRegistry);

        charityId = requestedCharityId;
        if (charityId == 0 || !registry.isActiveCharity(charityId)) {
            charityId = registry.getDefaultCharityId();
        }

        if (charityId == 0 || !registry.isActiveCharity(charityId)) {
            revert InvalidCharityResolution(charityId);
        }

        charityWallet = registry.getCharityWallet(charityId);
        if (charityWallet == address(0)) revert InvalidCharityResolution(charityId);
    }

    function _grossCadValueFromTcoin(uint256 tcoinAmount) internal view returns (uint256 grossCad18) {
        grossCad18 = (tcoinAmount * cadPeg18) / VALUE_SCALE;
    }

    function _tcoinFromCad(uint256 cadValue18) internal view returns (uint256 tcoinAmount) {
        tcoinAmount = (cadValue18 * VALUE_SCALE) / cadPeg18;
    }

    function _assetAmountFromCad(bytes32 assetId, uint256 cadValue18)
        internal
        view
        returns (uint256 assetAmount, bool usedFallback)
    {
        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        (uint256 price18,, bool usedFallbackQuote) = IOracleRouter(oracleRouter).getCadPrice(assetId);
        assetAmount = (cadValue18 * (10 ** asset.tokenDecimals)) / price18;
        usedFallback = usedFallbackQuote;
    }

    function _previewRedeem(bytes32 assetId, uint256 tcoinAmount, uint256 rateBps)
        internal
        view
        returns (uint256 assetOut, bool usedFallbackOracle, uint256 grossCad18, uint256 redeemableCad18)
    {
        _resolveActiveAsset(assetId);
        grossCad18 = _grossCadValueFromTcoin(tcoinAmount);
        redeemableCad18 = (grossCad18 * rateBps) / BPS_DENOMINATOR;
        (assetOut, usedFallbackOracle) = _assetAmountFromCad(assetId, redeemableCad18);
    }

    function _ensureSufficientReserve(bytes32 assetId, uint256 requested) internal view {
        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        uint256 available = IERC20(asset.token).balanceOf(address(this));
        if (available < requested) {
            revert InsufficientReserveBalance(assetId, requested, available);
        }
    }

    function _setCadPeg(uint256 newCadPeg18, bool initializing) internal {
        if (newCadPeg18 == 0) revert InvalidCadPeg();
        uint256 old = cadPeg18;
        if (!initializing && old != 0) {
            uint256 lowerBound = old - ((old * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);
            uint256 upperBound = old + ((old * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);
            if (newCadPeg18 < lowerBound || newCadPeg18 > upperBound) {
                revert InvalidPegChange(old, newCadPeg18);
            }
        }
        cadPeg18 = newCadPeg18;
        emit CadPegUpdated(old, newCadPeg18);
    }

    function _setUserRedeemRate(uint256 newRateBps) internal {
        if (newRateBps > BPS_DENOMINATOR) revert InvalidRedeemRate();
        uint256 old = userRedeemRateBps;
        userRedeemRateBps = newRateBps;
        emit UserRedeemRateUpdated(old, newRateBps);
    }

    function _setMerchantRedeemRate(uint256 newRateBps) internal {
        if (newRateBps > BPS_DENOMINATOR) revert InvalidRedeemRate();
        uint256 old = merchantRedeemRateBps;
        merchantRedeemRateBps = newRateBps;
        emit MerchantRedeemRateUpdated(old, newRateBps);
    }

    function _setCharityMintRate(uint256 newRateBps) internal {
        if (newRateBps > BPS_DENOMINATOR) revert InvalidCharityMintRate();
        uint256 old = charityMintRateBps;
        charityMintRateBps = newRateBps;
        emit CharityMintRateUpdated(old, newRateBps);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}

```

## ./UserCharityPreferencesRegistry.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ICharityRegistryForPreferences {
    function isActiveCharity(uint256 charityId) external view returns (bool);
    function getDefaultCharityId() external view returns (uint256);
    function getCharityWallet(uint256 charityId) external view returns (address);
}

contract UserCharityPreferencesRegistry is Ownable {
    struct UserCharityPreferences {
        uint256 preferredCharityId; // 0 means "no explicit preference"
        uint16 voluntaryFeeBps;     // extra fee on top of token-level base fee
    }

    error ZeroAddressOwner();
    error ZeroAddressCharityRegistry();
    error InvalidPreferredCharity(uint256 charityId);
    error InvalidVoluntaryFeeBps(uint16 feeBps, uint16 maxFeeBps);
    error SameAddress();
    error CharityResolutionFailed(uint256 requestedCharityId);
    error ZeroWalletForResolvedCharity(uint256 charityId);

    event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event MaxVoluntaryFeeBpsUpdated(uint16 oldMaxFeeBps, uint16 newMaxFeeBps);

    event PreferredCharityUpdated(
        address indexed user,
        uint256 indexed oldCharityId,
        uint256 indexed newCharityId
    );

    event VoluntaryFeeBpsUpdated(
        address indexed user,
        uint16 oldFeeBps,
        uint16 newFeeBps
    );

    event PreferencesUpdated(
        address indexed user,
        uint256 indexed oldCharityId,
        uint256 indexed newCharityId,
        uint16 oldFeeBps,
        uint16 newFeeBps
    );

    address public charityRegistry;
    uint16 public maxVoluntaryFeeBps;

    mapping(address => UserCharityPreferences) private _preferences;

    constructor(
        address initialOwner,
        address charityRegistry_,
        uint16 maxVoluntaryFeeBps_
    ) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        if (charityRegistry_ == address(0)) revert ZeroAddressCharityRegistry();
        _transferOwnership(initialOwner);

        charityRegistry = charityRegistry_;
        maxVoluntaryFeeBps = maxVoluntaryFeeBps_;

        emit CharityRegistryUpdated(address(0), charityRegistry_);
        emit MaxVoluntaryFeeBpsUpdated(0, maxVoluntaryFeeBps_);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setCharityRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddressCharityRegistry();
        if (newRegistry == charityRegistry) revert SameAddress();

        address oldRegistry = charityRegistry;
        charityRegistry = newRegistry;

        emit CharityRegistryUpdated(oldRegistry, newRegistry);
    }

    function setMaxVoluntaryFeeBps(uint16 newMaxFeeBps) external onlyOwner {
        uint16 oldMaxFeeBps = maxVoluntaryFeeBps;
        maxVoluntaryFeeBps = newMaxFeeBps;

        emit MaxVoluntaryFeeBpsUpdated(oldMaxFeeBps, newMaxFeeBps);
    }

    // -------------------------------------------------------------------------
    // User writes
    // -------------------------------------------------------------------------

    function setPreferredCharity(uint256 charityId) external {
        if (charityId != 0 && !_isActiveCharity(charityId)) {
            revert InvalidPreferredCharity(charityId);
        }

        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint256 oldCharityId = pref.preferredCharityId;
        pref.preferredCharityId = charityId;

        emit PreferredCharityUpdated(msg.sender, oldCharityId, charityId);
    }

    function clearPreferredCharity() external {
        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint256 oldCharityId = pref.preferredCharityId;
        pref.preferredCharityId = 0;

        emit PreferredCharityUpdated(msg.sender, oldCharityId, 0);
    }

    function setVoluntaryFeeBps(uint16 feeBps) external {
        if (feeBps > maxVoluntaryFeeBps) {
            revert InvalidVoluntaryFeeBps(feeBps, maxVoluntaryFeeBps);
        }

        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint16 oldFeeBps = pref.voluntaryFeeBps;
        pref.voluntaryFeeBps = feeBps;

        emit VoluntaryFeeBpsUpdated(msg.sender, oldFeeBps, feeBps);
    }

    function clearVoluntaryFeeBps() external {
        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint16 oldFeeBps = pref.voluntaryFeeBps;
        pref.voluntaryFeeBps = 0;

        emit VoluntaryFeeBpsUpdated(msg.sender, oldFeeBps, 0);
    }

    function setPreferences(uint256 charityId, uint16 feeBps) external {
        if (charityId != 0 && !_isActiveCharity(charityId)) {
            revert InvalidPreferredCharity(charityId);
        }
        if (feeBps > maxVoluntaryFeeBps) {
            revert InvalidVoluntaryFeeBps(feeBps, maxVoluntaryFeeBps);
        }

        UserCharityPreferences storage pref = _preferences[msg.sender];

        uint256 oldCharityId = pref.preferredCharityId;
        uint16 oldFeeBps = pref.voluntaryFeeBps;

        pref.preferredCharityId = charityId;
        pref.voluntaryFeeBps = feeBps;

        emit PreferencesUpdated(
            msg.sender,
            oldCharityId,
            charityId,
            oldFeeBps,
            feeBps
        );
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getPreferences(address user)
        external
        view
        returns (uint256 preferredCharityId, uint16 voluntaryFeeBps)
    {
        UserCharityPreferences storage pref = _preferences[user];
        return (pref.preferredCharityId, pref.voluntaryFeeBps);
    }

    function getPreferredCharity(address user) external view returns (uint256) {
        return _preferences[user].preferredCharityId;
    }

    function getVoluntaryFeeBps(address user) external view returns (uint16) {
        return _preferences[user].voluntaryFeeBps;
    }

    /// @notice Resolve a user's current charity destination and voluntary fee.
    /// @dev If the stored preferred charity is zero or no longer active, falls back
    ///      to the CharityRegistry default charity.
    function resolveFeePreferences(address user)
        external
        view
        returns (
            uint256 resolvedCharityId,
            address charityWallet,
            uint16 voluntaryFeeBps
        )
    {
        UserCharityPreferences storage pref = _preferences[user];
        voluntaryFeeBps = pref.voluntaryFeeBps;

        resolvedCharityId = pref.preferredCharityId;

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            resolvedCharityId = ICharityRegistryForPreferences(charityRegistry).getDefaultCharityId();
        }

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            revert CharityResolutionFailed(pref.preferredCharityId);
        }

        charityWallet = ICharityRegistryForPreferences(charityRegistry).getCharityWallet(resolvedCharityId);
        if (charityWallet == address(0)) {
            revert ZeroWalletForResolvedCharity(resolvedCharityId);
        }
    }

    /// @notice Convenience method for frontends and token preview helpers.
    function previewResolvedCharity(address user)
        external
        view
        returns (
            uint256 requestedCharityId,
            uint256 resolvedCharityId,
            address charityWallet,
            bool fellBackToDefault
        )
    {
        requestedCharityId = _preferences[user].preferredCharityId;
        resolvedCharityId = requestedCharityId;

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            resolvedCharityId = ICharityRegistryForPreferences(charityRegistry).getDefaultCharityId();
            fellBackToDefault = true;
        }

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            revert CharityResolutionFailed(requestedCharityId);
        }

        charityWallet = ICharityRegistryForPreferences(charityRegistry).getCharityWallet(resolvedCharityId);
        if (charityWallet == address(0)) {
            revert ZeroWalletForResolvedCharity(resolvedCharityId);
        }
    }

    function hasExplicitPreference(address user) external view returns (bool) {
        return _preferences[user].preferredCharityId != 0;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _isActiveCharity(uint256 charityId) internal view returns (bool) {
        return ICharityRegistryForPreferences(charityRegistry).isActiveCharity(charityId);
    }
}
```

## ./interfaces/ICharityRegistry.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICharityRegistry {
    function addCharity(string calldata name, address wallet, string calldata metadataRecordId)
        external
        returns (uint256 charityId);

    function removeCharity(uint256 charityId) external;
    function suspendCharity(uint256 charityId) external;
    function unsuspendCharity(uint256 charityId) external;
    function setDefaultCharity(uint256 charityId) external;

    function getDefaultCharityId() external view returns (uint256);
    function isActiveCharity(uint256 charityId) external view returns (bool);
    function getCharityWallet(uint256 charityId) external view returns (address);
}

```

## ./interfaces/IGovernance.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGovernance {
    function executeProposal(uint256 proposalId) external;
    function cancelProposal(uint256 proposalId) external;
}

```

## ./interfaces/IOracleRouter.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleRouter {
    function previewCadValue(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 cadValue18, uint256 updatedAt, bool usedFallback);

    function getCadPrice(bytes32 assetId)
        external
        view
        returns (uint256 price18, uint256 updatedAt, bool usedFallback);
}

```

## ./interfaces/IPoolRegistry.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPoolRegistry {
    enum MerchantStatus {
        None,
        Approved,
        Suspended,
        Removed
    }

    struct MerchantEntity {
        bytes32 merchantId;
        bytes32 poolId;
        string metadataRecordId;
        MerchantStatus status;
        bool acceptsCplTcoin;
        bool posFeeEligible;
        uint64 createdAt;
        uint64 updatedAt;
    }

    function addPool(bytes32 poolId, string calldata name, string calldata metadataRecordId) external;
    function removePool(bytes32 poolId) external;
    function suspendPool(bytes32 poolId) external;
    function unsuspendPool(bytes32 poolId) external;

    function approveMerchant(
        bytes32 merchantId,
        bytes32 poolId,
        string calldata metadataRecordId,
        address[] calldata initialWallets
    ) external;

    function addMerchantWallet(bytes32 merchantId, address wallet) external;
    function removeMerchantWallet(bytes32 merchantId, address wallet) external;
    function setMerchantCplAcceptance(bytes32 merchantId, bool acceptsCplTcoin) external;
    function setMerchantPosFeeEligibility(bytes32 merchantId, bool posFeeEligible) external;
    function removeMerchant(bytes32 merchantId) external;
    function suspendMerchant(bytes32 merchantId) external;
    function unsuspendMerchant(bytes32 merchantId) external;
    function reassignMerchantPool(bytes32 merchantId, bytes32 newPoolId) external;

    function getMerchant(bytes32 merchantId) external view returns (MerchantEntity memory);
    function getMerchantIdByWallet(address wallet) external view returns (bytes32);
    function getMerchantWallets(bytes32 merchantId) external view returns (address[] memory);
    function getMerchantPaymentConfig(address wallet)
        external
        view
        returns (
            bool exists_,
            bytes32 merchantId_,
            bool approved_,
            bool poolActive_,
            bool acceptsCpl_,
            bool posFeeEligible_,
            bytes32 poolId_
        );

    function isMerchantWallet(address wallet) external view returns (bool);
    function isMerchantApprovedWallet(address wallet) external view returns (bool);
    function isMerchantPaymentTarget(address wallet) external view returns (bool);
    function isMerchantPosFeeTarget(address wallet) external view returns (bool);
    function acceptsCplTcoin(address wallet) external view returns (bool);

    function isMerchantApprovedInActivePool(address wallet) external view returns (bool);
    function getMerchantPool(address wallet) external view returns (bytes32);
}

```

## ./interfaces/IReserveRegistry.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReserveRegistry {
    enum ReserveAssetStatus {
        None,
        Active,
        Paused,
        Removed
    }

    struct ReserveAsset {
        bytes32 assetId;
        address token;
        string code;
        uint8 tokenDecimals;
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
        ReserveAssetStatus status;
    }

    function addReserveAsset(
        bytes32 assetId,
        address token,
        string calldata code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter
    ) external;

    function removeReserveAsset(bytes32 assetId) external;
    function pauseReserveAsset(bytes32 assetId) external;
    function unpauseReserveAsset(bytes32 assetId) external;

    function updateReserveAssetOracles(
        bytes32 assetId,
        address primaryOracle,
        address fallbackOracle
    ) external;

    function updateReserveAssetStaleness(bytes32 assetId, uint256 staleAfter) external;

    function getReserveAsset(bytes32 assetId) external view returns (ReserveAsset memory);
    function isReserveAssetActive(bytes32 assetId) external view returns (bool);
    function listReserveAssetIds() external view returns (bytes32[] memory);

    function getOracleConfig(bytes32 assetId)
        external
        view
        returns (
            address token,
            uint8 tokenDecimals,
            address primaryOracle,
            address fallbackOracle,
            uint256 staleAfter
        );
}

```

## ./interfaces/IStewardRegistry.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStewardRegistry {
    function isSteward(address steward) external view returns (bool);
    function getStewardWeight(address steward) external view returns (uint256);
    function getTotalActiveStewardWeight() external view returns (uint256);
    function listStewardAddresses() external view returns (address[] memory);

    function syncCharityAppointment(uint256 charityId, address oldSteward, address newSteward) external;
}

```

## ./interfaces/ISwapAdapter.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISwapAdapter {
    function swapToCadm(
        address tokenIn,
        address cadmToken,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 deadline,
        bytes calldata swapData
    ) external returns (uint256 cadmOut);

    function previewSwapToCadm(
        address tokenIn,
        address cadmToken,
        uint256 amountIn,
        bytes calldata swapData
    ) external view returns (uint256 cadmOut);
}

```

## ./LiquidityRouter.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITreasuryControllerForLiquidityRouter {
    function depositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount, address payer)
        external
        returns (uint256 mrTcoinOut);

    function previewDepositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, uint256 cadValue18, bool usedFallbackOracle);

    function getReserveAssetToken(bytes32 assetId) external view returns (address token);
    function treasury() external view returns (address);
    function tcoinToken() external view returns (address);
}

interface ICplTcoinForLiquidityRouter {
    function mint(address to, uint256 amount, bytes calldata data) external;
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IUserCharityPreferencesRegistryForLiquidityRouter {
    function resolveFeePreferences(address user)
        external
        view
        returns (uint256 resolvedCharityId, address charityWallet, uint16 voluntaryFeeBps);
}

interface IPoolRegistryForLiquidityRouter {
    function listPoolIds() external view returns (bytes32[] memory);
    function isPoolActive(bytes32 poolId) external view returns (bool);
}

interface IPoolAdapter {
    function getPoolLiquidityState(bytes32 poolId)
        external
        view
        returns (uint256 mrTcoinLiquidity, uint256 cplTcoinLiquidity, bool active);

    function previewBuyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn)
        external
        view
        returns (uint256 cplTcoinOut);

    function buyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn, uint256 minCplTcoinOut, address recipient)
        external
        returns (uint256 cplTcoinOut);

    function poolMatchesAnyMerchantPreference(bytes32 poolId, bytes32[] calldata preferredMerchantIds)
        external
        view
        returns (bool matchesPreference);

    function getPoolAccount(bytes32 poolId) external view returns (address poolAccount);
}

contract LiquidityRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct PoolSelection {
        bytes32 poolId;
        uint256 score;
        uint256 cplTcoinOut;
        bool found;
    }

    struct PoolCandidate {
        uint256 score;
        uint256 cplTcoinOut;
        bool eligible;
    }

    struct ReserveDepositContext {
        uint256 mrTcoinOut;
        address mrTcoinToken;
    }

    struct CharityResolution {
        uint256 charityId;
        address charityWallet;
    }

    struct BuyRequest {
        bytes32 reserveAssetId;
        uint256 reserveAssetAmount;
        uint256 minCplTcoinOut;
    }

    struct PurchaseResult {
        bytes32 selectedPoolId;
        uint256 mrTcoinUsed;
        uint256 cplTcoinOut;
        uint256 charityTopupOut;
        uint256 resolvedCharityId;
        address charityWallet;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressDependency();
    error ZeroPoolId();
    error ZeroAmount();
    error InvalidBps(uint256 bps);
    error Unauthorized();
    error SameAddress();
    error NoEligiblePool();
    error InvalidPoolAccount(bytes32 poolId);
    error InvalidCharityResolution(uint256 charityId);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event TreasuryControllerUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CplTcoinUpdated(address indexed oldToken, address indexed newToken);
    event CharityPreferencesRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);

    event CharityTopupBpsUpdated(uint256 oldBps, uint256 newBps);
    event ScoringWeightsUpdated(
        uint256 weightLowMrTcoinLiquidity,
        uint256 weightHighCplTcoinLiquidity,
        uint256 weightUserPoolPreference,
        uint256 weightUserMerchantPreference
    );

    event PoolSeeded(bytes32 indexed poolId, uint256 amount, address indexed actor);
    event PoolToppedUp(bytes32 indexed poolId, uint256 amount, address indexed actor);

    event CplTcoinPurchased(
        address indexed buyer,
        bytes32 indexed reserveAssetId,
        bytes32 indexed selectedPoolId,
        uint256 reserveAssetAmount,
        uint256 mrTcoinUsed,
        uint256 cplTcoinOut,
        uint256 charityTopupOut,
        uint256 resolvedCharityId,
        address charityWallet
    );

    address public governance;
    address public treasuryController;
    address public cplTcoin;
    address public charityPreferencesRegistry;
    address public poolRegistry;
    address public poolAdapter;

    uint256 public charityTopupBps;
    uint256 public weightLowMrTcoinLiquidity;
    uint256 public weightHighCplTcoinLiquidity;
    uint256 public weightUserPoolPreference;
    uint256 public weightUserMerchantPreference;

    constructor(
        address initialOwner,
        address governance_,
        address treasuryController_,
        address cplTcoin_,
        address charityPreferencesRegistry_,
        address poolRegistry_,
        address poolAdapter_
    ) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);

        _setGovernance(governance_);
        _setTreasuryController(treasuryController_);
        _setCplTcoin(cplTcoin_);
        _setCharityPreferencesRegistry(charityPreferencesRegistry_);
        _setPoolRegistry(poolRegistry_);
        _setPoolAdapter(poolAdapter_);

        charityTopupBps = 300;
        emit CharityTopupBpsUpdated(0, 300);

        weightLowMrTcoinLiquidity = 1;
        weightHighCplTcoinLiquidity = 1;
        weightUserPoolPreference = 100;
        weightUserMerchantPreference = 50;
        emit ScoringWeightsUpdated(1, 1, 100, 50);
    }

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    function buyCplTcoin(
        bytes32 reserveAssetId,
        uint256 reserveAssetAmount,
        uint256 minCplTcoinOut,
        bytes32[] calldata preferredPoolIds,
        bytes32[] calldata preferredMerchantIds
    )
        external
        nonReentrant
        returns (
            bytes32 selectedPoolId,
            uint256 mrTcoinUsed,
            uint256 cplTcoinOut,
            uint256 charityTopupOut,
            uint256 resolvedCharityId
        )
    {
        BuyRequest memory request = BuyRequest({
            reserveAssetId: reserveAssetId, reserveAssetAmount: reserveAssetAmount, minCplTcoinOut: minCplTcoinOut
        });
        PurchaseResult memory result = _buyCplTcoin(request, preferredPoolIds, preferredMerchantIds);
        return (
            result.selectedPoolId,
            result.mrTcoinUsed,
            result.cplTcoinOut,
            result.charityTopupOut,
            result.resolvedCharityId
        );
    }

    function previewBuyCplTcoin(
        bytes32 reserveAssetId,
        uint256 reserveAssetAmount,
        bytes32[] calldata preferredPoolIds,
        bytes32[] calldata preferredMerchantIds
    )
        external
        view
        returns (
            bytes32 selectedPoolId,
            uint256 mrTcoinOut,
            uint256 cplTcoinOut,
            uint256 charityTopupOut,
            uint256 resolvedCharityId,
            address charityWallet
        )
    {
        BuyRequest memory request = BuyRequest({
            reserveAssetId: reserveAssetId, reserveAssetAmount: reserveAssetAmount, minCplTcoinOut: 0
        });
        PurchaseResult memory result = _previewBuyCplTcoin(request, preferredPoolIds, preferredMerchantIds);
        return (
            result.selectedPoolId,
            result.mrTcoinUsed,
            result.cplTcoinOut,
            result.charityTopupOut,
            result.resolvedCharityId,
            result.charityWallet
        );
    }

    function seedPoolWithCplTcoin(bytes32 poolId, uint256 amount) external onlyGovernanceOrOwner {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (amount == 0) revert ZeroAmount();

        address poolAccount = _resolvePoolAccount(poolId);
        ICplTcoinForLiquidityRouter(cplTcoin).mint(poolAccount, amount, "");

        emit PoolSeeded(poolId, amount, msg.sender);
    }

    function topUpPoolWithCplTcoin(bytes32 poolId, uint256 amount) external onlyGovernanceOrOwner {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (amount == 0) revert ZeroAmount();

        address poolAccount = _resolvePoolAccount(poolId);
        ICplTcoinForLiquidityRouter(cplTcoin).mint(poolAccount, amount, "");

        emit PoolToppedUp(poolId, amount, msg.sender);
    }

    function setGovernance(address governance_) external onlyOwner {
        _setGovernance(governance_);
    }

    function setTreasuryController(address treasury_) external onlyGovernanceOrOwner {
        _setTreasuryController(treasury_);
    }

    function setCplTcoin(address cplTcoin_) external onlyGovernanceOrOwner {
        _setCplTcoin(cplTcoin_);
    }

    function setCharityPreferencesRegistry(address registry_) external onlyGovernanceOrOwner {
        _setCharityPreferencesRegistry(registry_);
    }

    function setPoolRegistry(address registry_) external onlyGovernanceOrOwner {
        _setPoolRegistry(registry_);
    }

    function setPoolAdapter(address adapter_) external onlyGovernanceOrOwner {
        _setPoolAdapter(adapter_);
    }

    function setCharityTopupBps(uint256 newBps) external onlyGovernanceOrOwner {
        uint256 oldBps = charityTopupBps;
        if (newBps > BPS_DENOMINATOR) revert InvalidBps(newBps);
        charityTopupBps = newBps;
        emit CharityTopupBpsUpdated(oldBps, newBps);
    }

    function setScoringWeights(
        uint256 newWeightLowMrTcoinLiquidity,
        uint256 newWeightHighCplTcoinLiquidity,
        uint256 newWeightUserPoolPreference,
        uint256 newWeightUserMerchantPreference
    ) external onlyGovernanceOrOwner {
        weightLowMrTcoinLiquidity = newWeightLowMrTcoinLiquidity;
        weightHighCplTcoinLiquidity = newWeightHighCplTcoinLiquidity;
        weightUserPoolPreference = newWeightUserPoolPreference;
        weightUserMerchantPreference = newWeightUserMerchantPreference;

        emit ScoringWeightsUpdated(
            newWeightLowMrTcoinLiquidity,
            newWeightHighCplTcoinLiquidity,
            newWeightUserPoolPreference,
            newWeightUserMerchantPreference
        );
    }

    function _selectPool(
        uint256 mrTcoinOut,
        uint256 minCplTcoinOut,
        bytes32[] calldata preferredPoolIds,
        bytes32[] calldata preferredMerchantIds
    ) internal view returns (PoolSelection memory best) {
        bytes32[] memory poolIds = IPoolRegistryForLiquidityRouter(poolRegistry).listPoolIds();

        for (uint256 i = 0; i < poolIds.length; ++i) {
            bytes32 poolId = poolIds[i];
            PoolCandidate memory candidate =
                _evaluatePoolCandidate(poolId, mrTcoinOut, minCplTcoinOut, preferredPoolIds, preferredMerchantIds);
            if (!candidate.eligible) continue;

            if (
                !best.found || candidate.score > best.score
                    || (candidate.score == best.score && candidate.cplTcoinOut > best.cplTcoinOut)
                    || (candidate.score == best.score
                        && candidate.cplTcoinOut == best.cplTcoinOut
                        && poolId < best.poolId)
            ) {
                best = PoolSelection({
                    poolId: poolId, score: candidate.score, cplTcoinOut: candidate.cplTcoinOut, found: true
                });
            }
        }

        if (!best.found) revert NoEligiblePool();
    }

    function _evaluatePoolCandidate(
        bytes32 poolId,
        uint256 mrTcoinOut,
        uint256 minCplTcoinOut,
        bytes32[] calldata preferredPoolIds,
        bytes32[] calldata preferredMerchantIds
    ) internal view returns (PoolCandidate memory candidate) {
        if (!IPoolRegistryForLiquidityRouter(poolRegistry).isPoolActive(poolId)) {
            return candidate;
        }

        (uint256 mrLiquidity, uint256 cplLiquidity, bool active) =
            IPoolAdapter(poolAdapter).getPoolLiquidityState(poolId);
        if (!active) {
            return candidate;
        }

        candidate.cplTcoinOut = IPoolAdapter(poolAdapter).previewBuyCplTcoinFromPool(poolId, mrTcoinOut);
        if (
            candidate.cplTcoinOut == 0 || candidate.cplTcoinOut < minCplTcoinOut || cplLiquidity < candidate.cplTcoinOut
        ) {
            return candidate;
        }

        candidate.score =
            _scorePool(poolId, mrTcoinOut, mrLiquidity, cplLiquidity, preferredPoolIds, preferredMerchantIds);
        candidate.eligible = true;
    }

    function _buyCplTcoin(
        BuyRequest memory request,
        bytes32[] calldata preferredPoolIds,
        bytes32[] calldata preferredMerchantIds
    ) internal returns (PurchaseResult memory result) {
        if (request.reserveAssetAmount == 0) revert ZeroAmount();

        ReserveDepositContext memory depositContext =
            _collectReserveAndDeposit(request.reserveAssetId, request.reserveAssetAmount, msg.sender);
        result.mrTcoinUsed = depositContext.mrTcoinOut;

        PoolSelection memory selection =
            _selectPool(result.mrTcoinUsed, request.minCplTcoinOut, preferredPoolIds, preferredMerchantIds);
        result.selectedPoolId = selection.poolId;
        _approveExact(depositContext.mrTcoinToken, poolAdapter, result.mrTcoinUsed);
        result.cplTcoinOut = _buyFromPool(result.selectedPoolId, result.mrTcoinUsed, request.minCplTcoinOut, msg.sender);

        CharityResolution memory charity = _resolveCharity(msg.sender);
        result.resolvedCharityId = charity.charityId;
        result.charityWallet = charity.charityWallet;
        result.charityTopupOut = (result.cplTcoinOut * charityTopupBps) / BPS_DENOMINATOR;

        if (result.charityTopupOut > 0) {
            ICplTcoinForLiquidityRouter(cplTcoin).mint(result.charityWallet, result.charityTopupOut, "");
        }

        emit CplTcoinPurchased(
            msg.sender,
            request.reserveAssetId,
            result.selectedPoolId,
            request.reserveAssetAmount,
            result.mrTcoinUsed,
            result.cplTcoinOut,
            result.charityTopupOut,
            result.resolvedCharityId,
            result.charityWallet
        );
    }

    function _previewBuyCplTcoin(
        BuyRequest memory request,
        bytes32[] calldata preferredPoolIds,
        bytes32[] calldata preferredMerchantIds
    ) internal view returns (PurchaseResult memory result) {
        if (request.reserveAssetAmount == 0) revert ZeroAmount();

        (result.mrTcoinUsed,,) = ITreasuryControllerForLiquidityRouter(treasuryController)
            .previewDepositAssetForLiquidityRoute(request.reserveAssetId, request.reserveAssetAmount);

        PoolSelection memory selection =
            _selectPool(result.mrTcoinUsed, request.minCplTcoinOut, preferredPoolIds, preferredMerchantIds);
        result.selectedPoolId = selection.poolId;
        result.cplTcoinOut = selection.cplTcoinOut;
        result.charityTopupOut = (result.cplTcoinOut * charityTopupBps) / BPS_DENOMINATOR;

        CharityResolution memory charity = _resolveCharity(msg.sender);
        result.resolvedCharityId = charity.charityId;
        result.charityWallet = charity.charityWallet;
    }

    function _scorePool(
        bytes32 poolId,
        uint256 mrTcoinOut,
        uint256 mrLiquidity,
        uint256 cplLiquidity,
        bytes32[] calldata preferredPoolIds,
        bytes32[] calldata preferredMerchantIds
    ) internal view returns (uint256 score) {
        uint256 mrNeed = mrTcoinOut > mrLiquidity ? mrTcoinOut - mrLiquidity : 0;

        score += mrNeed * weightLowMrTcoinLiquidity;
        score += cplLiquidity * weightHighCplTcoinLiquidity;

        if (_containsBytes32(preferredPoolIds, poolId)) {
            score += weightUserPoolPreference;
        }

        if (
            preferredMerchantIds.length > 0
                && IPoolAdapter(poolAdapter).poolMatchesAnyMerchantPreference(poolId, preferredMerchantIds)
        ) {
            score += weightUserMerchantPreference;
        }
    }

    function _resolvePoolAccount(bytes32 poolId) internal view returns (address poolAccount) {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (!IPoolRegistryForLiquidityRouter(poolRegistry).isPoolActive(poolId)) revert NoEligiblePool();

        poolAccount = IPoolAdapter(poolAdapter).getPoolAccount(poolId);
        if (poolAccount == address(0)) revert InvalidPoolAccount(poolId);
    }

    function _setGovernance(address governance_) internal {
        address oldGovernance = governance;
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == oldGovernance) revert SameAddress();
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }

    function _setTreasuryController(address treasury_) internal {
        address oldTreasury = treasuryController;
        if (treasury_ == address(0)) revert ZeroAddressDependency();
        if (treasury_ == oldTreasury) revert SameAddress();
        treasuryController = treasury_;
        emit TreasuryControllerUpdated(oldTreasury, treasury_);
    }

    function _setCplTcoin(address cplTcoin_) internal {
        address oldToken = cplTcoin;
        if (cplTcoin_ == address(0)) revert ZeroAddressDependency();
        if (cplTcoin_ == oldToken) revert SameAddress();
        cplTcoin = cplTcoin_;
        emit CplTcoinUpdated(oldToken, cplTcoin_);
    }

    function _setCharityPreferencesRegistry(address registry_) internal {
        address oldRegistry = charityPreferencesRegistry;
        if (registry_ == address(0)) revert ZeroAddressDependency();
        if (registry_ == oldRegistry) revert SameAddress();
        charityPreferencesRegistry = registry_;
        emit CharityPreferencesRegistryUpdated(oldRegistry, registry_);
    }

    function _setPoolRegistry(address registry_) internal {
        address oldRegistry = poolRegistry;
        if (registry_ == address(0)) revert ZeroAddressDependency();
        if (registry_ == oldRegistry) revert SameAddress();
        poolRegistry = registry_;
        emit PoolRegistryUpdated(oldRegistry, registry_);
    }

    function _setPoolAdapter(address adapter_) internal {
        address oldAdapter = poolAdapter;
        if (adapter_ == address(0)) revert ZeroAddressDependency();
        if (adapter_ == oldAdapter) revert SameAddress();
        poolAdapter = adapter_;
        emit PoolAdapterUpdated(oldAdapter, adapter_);
    }

    function _collectReserveAndDeposit(bytes32 reserveAssetId, uint256 reserveAssetAmount, address payer)
        internal
        returns (ReserveDepositContext memory context)
    {
        address treasuryVault = ITreasuryControllerForLiquidityRouter(treasuryController).treasury();
        address reserveAssetToken =
            ITreasuryControllerForLiquidityRouter(treasuryController).getReserveAssetToken(reserveAssetId);

        IERC20(reserveAssetToken).safeTransferFrom(payer, address(this), reserveAssetAmount);
        _approveExact(reserveAssetToken, treasuryVault, reserveAssetAmount);

        context.mrTcoinOut = ITreasuryControllerForLiquidityRouter(treasuryController)
            .depositAssetForLiquidityRoute(reserveAssetId, reserveAssetAmount, address(this));
        context.mrTcoinToken = ITreasuryControllerForLiquidityRouter(treasuryController).tcoinToken();
    }

    function _resolveCharity(address payer) internal view returns (CharityResolution memory charity) {
        (charity.charityId, charity.charityWallet,) =
            IUserCharityPreferencesRegistryForLiquidityRouter(charityPreferencesRegistry).resolveFeePreferences(payer);
        if (charity.charityId == 0 || charity.charityWallet == address(0)) {
            revert InvalidCharityResolution(charity.charityId);
        }
    }

    function _buyFromPool(bytes32 poolId, uint256 mrTcoinAmountIn, uint256 minCplTcoinOut, address recipient)
        internal
        returns (uint256 cplTcoinOut)
    {
        cplTcoinOut = IPoolAdapter(poolAdapter).buyCplTcoinFromPool(poolId, mrTcoinAmountIn, minCplTcoinOut, recipient);
    }

    function _approveExact(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        erc20.safeApprove(spender, 0);
        erc20.safeApprove(spender, amount);
    }

    function _containsBytes32(bytes32[] calldata values, bytes32 needle) internal pure returns (bool) {
        for (uint256 i = 0; i < values.length; ++i) {
            if (values[i] == needle) return true;
        }
        return false;
    }
}

```

## ./interfaces/ITCOINToken.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITCOINToken {
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function mint(address to, uint256 amount, bytes calldata data) external;
    function mintTo(address beneficiary, uint256 amount) external returns (bool);
    function burn(uint256 amount) external returns (bool);
    function setExpirePeriod(uint256 expirePeriod) external;
}

```

## ./interfaces/ITreasuryController.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryController {
    function cadPeg18() external view returns (uint256);
    function setCadPeg(uint256 newCadPeg18) external;
    function setUserRedeemRate(uint256 newRateBps) external;
    function setMerchantRedeemRate(uint256 newRateBps) external;
    function setCharityMintRate(uint256 newRateBps) external;
    function setOvercollateralizationTarget(uint256 newTarget18) external;
    function setAdminCanMintToCharity(bool enabled) external;
    function mintToCharity(uint256 amount) external;
    function mintToCharity(uint256 charityId, uint256 amount) external;
}

```

## ./interfaces/ITreasuryVault.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryVault {
    function depositReserveFrom(address from, address token, uint256 amount) external returns (bool);
    function withdrawReserveTo(address to, address token, uint256 amount) external returns (bool);
    function reserveBalance(address token) external view returns (uint256);
}

```

## ./interfaces/ITreasuryMinting.sol

```bash sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryMinting {
    function depositAndMint(
        bytes32 assetId,
        uint256 assetAmount,
        uint256 requestedCharityId,
        uint256 minTcoinOut
    ) external returns (uint256 userTcoinOut, uint256 charityTcoinOut);

    function previewMint(
        bytes32 assetId,
        uint256 assetAmount,
        uint256 requestedCharityId
    )
        external
        view
        returns (
            uint256 userTcoinOut,
            uint256 charityTcoinOut,
            uint256 resolvedCharityId,
            bool usedFallbackOracle,
            uint256 cadValue18
        );

    function tcoinToken() external view returns (address);
    function treasury() external view returns (address);
}

```
