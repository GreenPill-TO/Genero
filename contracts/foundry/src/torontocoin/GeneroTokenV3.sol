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
