// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../TCOIN.sol";
import "../TTCCOIN.sol";
import "../CADCOIN.sol";
import "./interfaces/IVotingV2.sol";

contract OrchestratorV2 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct Steward {
        uint256 id;
        string name;
        address stewardAddress;
    }

    struct ReserveCurrency {
        bytes32 code;
        address token;
        uint8 decimals;
        bool enabled;
    }

    TCOIN private tcoin;
    TTC private ttc;
    CAD private cad;
    address public voting;

    address public charityAddress;
    address public reserveTokensAddress;

    uint256 public pegValue;
    uint256 public stewardCount;
    uint256 public redemptionRateUserTTC;
    uint256 public redemptionRateStoreTTC;
    uint256 public redemptionRateUserCAD;
    uint256 public redemptionRateStoreCAD;
    uint256 public minimumReserveRatio;
    uint256 public maximumReserveRatio;
    uint256 public demurrageRate;
    uint256 public reserveRatio;

    mapping(uint256 => string) public charityNames;
    mapping(uint256 => address) public charityAddresses;
    mapping(address => bool) public isCharityAddress;
    mapping(address => uint256) public charityTotalMintable;

    mapping(uint256 => Steward) public stewards;
    mapping(address => bool) public isStewardAddress;

    mapping(bytes32 => ReserveCurrency) public reserveCurrencies;
    bytes32[] public reserveCurrencyCodes;
    mapping(bytes32 => bool) private reserveCurrencyExists;

    event VotingAddressUpdated(address indexed votingAddress);
    event TcoinAddressUpdated(address indexed tcoinAddress);
    event TtcAddressUpdated(address indexed ttcAddress);
    event CadAddressUpdated(address indexed cadAddress);
    event CharityAddressUpdated(address indexed charityAddress);
    event ReserveTokensAddressUpdated(address indexed reserveTokensAddress);

    event GovernanceValuesApplied(
        uint256 pegValue,
        uint256 redemptionRateUserTTC,
        uint256 redemptionRateStoreTTC,
        uint256 redemptionRateUserCAD,
        uint256 redemptionRateStoreCAD,
        uint256 minimumReserveRatio,
        uint256 maximumReserveRatio,
        uint256 demurrageRate,
        uint256 reserveRatio
    );

    event CharityAdded(uint256 indexed id, string name, address indexed charity, address indexed actor);
    event StewardNominated(uint256 indexed id, string name, address indexed stewardAddress, address indexed actor);
    event ReserveCurrencyAdded(bytes32 indexed code, address indexed token, uint8 decimals, address indexed actor);
    event ReserveCurrencyStateUpdated(bytes32 indexed code, bool enabled, address indexed actor);

    modifier onlyVotingOrOwner() {
        require(msg.sender == owner() || msg.sender == voting, "orchestrator: caller not owner/voting");
        _;
    }

    function initialize(
        address tcoinAddress,
        address ttcAddress,
        address cadAddress,
        address charityAddress_,
        address reserveTokensAddress_,
        address votingAddress
    ) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        require(tcoinAddress != address(0), "orchestrator: tcoin required");
        require(ttcAddress != address(0), "orchestrator: ttc required");
        require(cadAddress != address(0), "orchestrator: cad required");

        tcoin = TCOIN(tcoinAddress);
        ttc = TTC(ttcAddress);
        cad = CAD(cadAddress);

        charityAddress = charityAddress_;
        reserveTokensAddress = reserveTokensAddress_;
        voting = votingAddress;

        pegValue = 330;
        redemptionRateUserTTC = 92;
        redemptionRateStoreTTC = 95;
        redemptionRateUserCAD = 87;
        redemptionRateStoreCAD = 90;
        minimumReserveRatio = 800_000;
        maximumReserveRatio = 1_200_000;
        demurrageRate = tcoin.getDemurrageRate();
        reserveRatio = calculateReserveRatio();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setTcoinAddress(address tcoinAddress) external onlyOwner {
        require(tcoinAddress != address(0), "orchestrator: tcoin required");
        tcoin = TCOIN(tcoinAddress);
        emit TcoinAddressUpdated(tcoinAddress);
    }

    function setTtcAddress(address ttcAddress) external onlyOwner {
        require(ttcAddress != address(0), "orchestrator: ttc required");
        ttc = TTC(ttcAddress);
        emit TtcAddressUpdated(ttcAddress);
    }

    function setCadAddress(address cadAddress) external onlyOwner {
        require(cadAddress != address(0), "orchestrator: cad required");
        cad = CAD(cadAddress);
        emit CadAddressUpdated(cadAddress);
    }

    function setVotingAddress(address votingAddress) external onlyOwner {
        require(votingAddress != address(0), "orchestrator: voting required");
        voting = votingAddress;
        emit VotingAddressUpdated(votingAddress);
    }

    function setCharityAddress(address charityAddress_) external onlyOwner {
        require(charityAddress_ != address(0), "orchestrator: charity required");
        charityAddress = charityAddress_;
        emit CharityAddressUpdated(charityAddress_);
    }

    function setReserveTokensAddress(address reserveTokensAddress_) external onlyOwner {
        require(reserveTokensAddress_ != address(0), "orchestrator: reserve required");
        reserveTokensAddress = reserveTokensAddress_;
        emit ReserveTokensAddressUpdated(reserveTokensAddress_);
    }

    function getPegValue() external view returns (uint256) {
        return pegValue;
    }

    function getStewardCount() external view returns (uint256) {
        return stewardCount;
    }

    function getRedemptionRateUserTTC() external view returns (uint256) {
        return redemptionRateUserTTC;
    }

    function getRedemptionRateStoreTTC() external view returns (uint256) {
        return redemptionRateStoreTTC;
    }

    function getRedemptionRateUserCAD() external view returns (uint256) {
        return redemptionRateUserCAD;
    }

    function getRedemptionRateStoreCAD() external view returns (uint256) {
        return redemptionRateStoreCAD;
    }

    function getMinimumReserveRatio() external view returns (uint256) {
        return minimumReserveRatio;
    }

    function getMaximumReserveRatio() external view returns (uint256) {
        return maximumReserveRatio;
    }

    function getDemurrageRate() external view returns (uint256) {
        return demurrageRate;
    }

    function getReserveRatio() external view returns (uint256) {
        return reserveRatio;
    }

    function calculateReserveRatio() public view returns (uint256) {
        uint256 totalRawSupply = tcoin.getTotalRawSupply();
        if (totalRawSupply == 0) {
            return 1_000_000;
        }

        uint256 totalTCOIN = tcoin.getTotalTCOINSupply();
        return (totalTCOIN * 1_000_000) / totalRawSupply;
    }

    function applyGovernanceValues(
        uint256 pegValue_,
        uint256 redemptionRateUserTTC_,
        uint256 redemptionRateStoreTTC_,
        uint256 redemptionRateUserCAD_,
        uint256 redemptionRateStoreCAD_,
        uint256 minimumReserveRatio_,
        uint256 maximumReserveRatio_,
        uint256 demurrageRate_,
        uint256 reserveRatio_
    ) external onlyOwner {
        pegValue = pegValue_;
        redemptionRateUserTTC = redemptionRateUserTTC_;
        redemptionRateStoreTTC = redemptionRateStoreTTC_;
        redemptionRateUserCAD = redemptionRateUserCAD_;
        redemptionRateStoreCAD = redemptionRateStoreCAD_;
        minimumReserveRatio = minimumReserveRatio_;
        maximumReserveRatio = maximumReserveRatio_;
        demurrageRate = demurrageRate_;
        reserveRatio = reserveRatio_;

        emit GovernanceValuesApplied(
            pegValue_,
            redemptionRateUserTTC_,
            redemptionRateStoreTTC_,
            redemptionRateUserCAD_,
            redemptionRateStoreCAD_,
            minimumReserveRatio_,
            maximumReserveRatio_,
            demurrageRate_,
            reserveRatio_
        );
    }

    function syncValuesFromVoting() external onlyOwner {
        require(voting != address(0), "orchestrator: voting unset");

        pegValue = IVotingV2(voting).getPegValue();
        redemptionRateUserTTC = IVotingV2(voting).getRedemptionRateUserTTC();
        redemptionRateStoreTTC = IVotingV2(voting).getRedemptionRateStoreTTC();
        redemptionRateUserCAD = IVotingV2(voting).getRedemptionRateUserCAD();
        redemptionRateStoreCAD = IVotingV2(voting).getRedemptionRateStoreCAD();
        minimumReserveRatio = IVotingV2(voting).getMinimumReserveRatio();
        maximumReserveRatio = IVotingV2(voting).getMaximumReserveRatio();
        demurrageRate = IVotingV2(voting).getDemurrageRate();
        reserveRatio = IVotingV2(voting).getReserveRatio();

        emit GovernanceValuesApplied(
            pegValue,
            redemptionRateUserTTC,
            redemptionRateStoreTTC,
            redemptionRateUserCAD,
            redemptionRateStoreCAD,
            minimumReserveRatio,
            maximumReserveRatio,
            demurrageRate,
            reserveRatio
        );
    }

    function addCharity(uint256 id, string calldata name, address charity) external onlyVotingOrOwner {
        require(charity != address(0), "orchestrator: charity required");
        require(charityAddresses[id] == address(0), "orchestrator: charity id exists");

        charityNames[id] = name;
        charityAddresses[id] = charity;
        isCharityAddress[charity] = true;

        emit CharityAdded(id, name, charity, msg.sender);
    }

    function nominateSteward(uint256 stewardId, string calldata name, address stewardAddress) external {
        require(stewardAddress != address(0), "orchestrator: steward required");
        require(
            isCharityAddress[msg.sender] || charityTotalMintable[msg.sender] > 0,
            "orchestrator: charity rights required"
        );

        address previous = stewards[stewardId].stewardAddress;
        if (previous == address(0)) {
            stewardCount += 1;
        } else {
            isStewardAddress[previous] = false;
        }

        stewards[stewardId] = Steward({id: stewardId, name: name, stewardAddress: stewardAddress});
        isStewardAddress[stewardAddress] = true;

        emit StewardNominated(stewardId, name, stewardAddress, msg.sender);
    }

    function isSteward(address addr) external view returns (bool) {
        return isStewardAddress[addr];
    }

    function isCharity(address charity) external view returns (bool) {
        return isCharityAddress[charity];
    }

    function addReserveCurrency(bytes32 code, address token, uint8 decimals) external onlyVotingOrOwner {
        require(code != bytes32(0), "orchestrator: code required");
        require(token != address(0), "orchestrator: token required");
        require(!reserveCurrencyExists[code], "orchestrator: code exists");

        reserveCurrencies[code] = ReserveCurrency({code: code, token: token, decimals: decimals, enabled: true});
        reserveCurrencyCodes.push(code);
        reserveCurrencyExists[code] = true;

        emit ReserveCurrencyAdded(code, token, decimals, msg.sender);
    }

    function disableReserveCurrency(bytes32 code) external onlyOwner {
        require(reserveCurrencyExists[code], "orchestrator: unknown code");
        reserveCurrencies[code].enabled = false;
        emit ReserveCurrencyStateUpdated(code, false, msg.sender);
    }

    function enableReserveCurrency(bytes32 code) external onlyOwner {
        require(reserveCurrencyExists[code], "orchestrator: unknown code");
        reserveCurrencies[code].enabled = true;
        emit ReserveCurrencyStateUpdated(code, true, msg.sender);
    }

    function getReserveCurrency(bytes32 code) external view returns (ReserveCurrency memory) {
        return reserveCurrencies[code];
    }

    function listReserveCurrencies() external view returns (ReserveCurrency[] memory list) {
        list = new ReserveCurrency[](reserveCurrencyCodes.length);
        for (uint256 i = 0; i < reserveCurrencyCodes.length; i++) {
            list[i] = reserveCurrencies[reserveCurrencyCodes[i]];
        }
    }

    function rebaseTCOIN() external onlyOwner {
        tcoin.rebase();
    }

    function updateDemurrageRate(uint256 newDemurrageRate) external onlyOwner {
        require(newDemurrageRate > 0, "orchestrator: invalid demurrage");
        demurrageRate = newDemurrageRate;
        tcoin.updateDemurrageRate(newDemurrageRate);
    }

    function updateRebasePeriod(uint256 newRebasePeriod) external onlyOwner {
        require(newRebasePeriod > 0, "orchestrator: invalid rebase period");
        tcoin.updateRebasePeriod(newRebasePeriod);
    }

    function whitelistStore(address store) external onlyOwner {
        require(store != address(0), "orchestrator: store required");
        tcoin.whitelistStore(store);
    }

    function removeStoreFromWhitelist(address store) external onlyOwner {
        require(store != address(0), "orchestrator: store required");
        tcoin.removeStoreFromWhitelist(store);
    }

    function mintTCOINForCharity(uint256 tcoinAmount) external {
        require(isCharityAddress[msg.sender], "orchestrator: not charity");
        require(charityTotalMintable[msg.sender] >= tcoinAmount, "orchestrator: insufficient mintable");

        charityTotalMintable[msg.sender] -= tcoinAmount;
        tcoin.mint(msg.sender, tcoinAmount);
    }
}
