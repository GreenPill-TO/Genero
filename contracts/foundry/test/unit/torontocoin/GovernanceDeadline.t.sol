// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Governance} from "../../../src/torontocoin/Governance.sol";
import {GovernanceExecutionHelper} from "../../../src/torontocoin/GovernanceExecutionHelper.sol";
import {GovernanceProposalHelper} from "../../../src/torontocoin/GovernanceProposalHelper.sol";
import {GovernanceRouterProposalHelper} from "../../../src/torontocoin/GovernanceRouterProposalHelper.sol";

contract MockStewardRegistry {
    mapping(address => bool) public isStewardMap;
    mapping(address => uint256) public weight;
    address[] public stewards;

    function setSteward(address steward, uint256 w) external {
        if (!isStewardMap[steward]) {
            stewards.push(steward);
        }
        isStewardMap[steward] = true;
        weight[steward] = w;
    }

    function isSteward(address steward) external view returns (bool) {
        return isStewardMap[steward];
    }

    function getStewardWeight(address steward) external view returns (uint256) {
        return weight[steward];
    }

    function getTotalActiveStewardWeight() external pure returns (uint256) {
        return 1;
    }

    function listStewardAddresses() external view returns (address[] memory) {
        return stewards;
    }
}

contract MockCharityRegistry {
    function addCharity(string calldata, address, string calldata) external pure returns (uint256) {
        return 1;
    }

    function removeCharity(uint256) external pure {}
    function suspendCharity(uint256) external pure {}
    function unsuspendCharity(uint256) external pure {}
    function setDefaultCharity(uint256) external pure {}
}

contract MockPoolRegistry {
    bytes32 public lastApprovedMerchantId;
    bytes32 public lastApprovedPoolId;
    string public lastApprovedMetadataRecordId;
    address[] private lastInitialWallets;

    function addPool(bytes32, string calldata, string calldata) external pure {}
    function removePool(bytes32) external pure {}
    function suspendPool(bytes32) external pure {}
    function unsuspendPool(bytes32) external pure {}

    function approveMerchant(
        bytes32 merchantId,
        bytes32 poolId,
        string calldata metadataRecordId,
        address[] calldata wallets
    ) external {
        lastApprovedMerchantId = merchantId;
        lastApprovedPoolId = poolId;
        lastApprovedMetadataRecordId = metadataRecordId;

        delete lastInitialWallets;
        for (uint256 i = 0; i < wallets.length; ++i) {
            lastInitialWallets.push(wallets[i]);
        }
    }

    function removeMerchant(bytes32) external pure {}
    function suspendMerchant(bytes32) external pure {}
    function unsuspendMerchant(bytes32) external pure {}
    function reassignMerchantPool(bytes32, bytes32) external pure {}

    function getLastInitialWallets() external view returns (address[] memory) {
        return lastInitialWallets;
    }
}

contract MockReserveRegistry {
    function addReserveAsset(bytes32, address, string calldata, uint8, address, address, uint256) external pure {}
    function removeReserveAsset(bytes32) external pure {}
    function pauseReserveAsset(bytes32) external pure {}
    function unpauseReserveAsset(bytes32) external pure {}
    function updateReserveAssetOracles(bytes32, address, address) external pure {}
    function updateReserveAssetStaleness(bytes32, uint256) external pure {}
}

contract MockOwned {
    error Unauthorized();

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}

contract MockTreasuryController is MockOwned {
    address public governance;
    address public treasury;
    address public indexer;
    address public liquidityRouter;
    address public tcoinToken;
    address public reserveRegistry;
    address public charityRegistry;
    address public poolRegistry;
    address public oracleRouter;

    uint256 public cadPeg18 = 1e18;
    uint256 public lastUserRate;
    uint256 public lastMerchantRate;
    uint256 public lastCharityMintRate;
    uint256 public lastOvercollateralizationTarget;
    uint256 public lastCharityMintAmount;
    uint256 public lastCharityMintCharityId;
    bool public lastCharityMintUsedDefault;
    bool public adminCanMintToCharity = true;
    bool public mintingPaused;
    bool public redemptionPaused;
    mapping(bytes32 => bool) public assetPaused;

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyCharityMintAuthority() {
        if (msg.sender == governance) {
            _;
            return;
        }

        if (msg.sender == owner && adminCanMintToCharity) {
            _;
            return;
        }

        revert Unauthorized();
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
    }

    function setGovernance(address governance_) external onlyOwner {
        governance = governance_;
    }

    function setIndexer(address indexer_) external onlyOwner {
        indexer = indexer_;
    }

    function setLiquidityRouter(address liquidityRouter_) external onlyOwner {
        liquidityRouter = liquidityRouter_;
    }

    function setTcoinToken(address tcoinToken_) external onlyOwner {
        tcoinToken = tcoinToken_;
    }

    function setReserveRegistry(address reserveRegistry_) external onlyOwner {
        reserveRegistry = reserveRegistry_;
    }

    function setCharityRegistry(address charityRegistry_) external onlyOwner {
        charityRegistry = charityRegistry_;
    }

    function setPoolRegistry(address poolRegistry_) external onlyOwner {
        poolRegistry = poolRegistry_;
    }

    function setOracleRouter(address oracleRouter_) external onlyOwner {
        oracleRouter = oracleRouter_;
    }

    function setCadPeg(uint256 newCadPeg18) external onlyGovernanceOrOwner {
        cadPeg18 = newCadPeg18;
    }

    function setUserRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        lastUserRate = newRateBps;
    }

    function setMerchantRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        lastMerchantRate = newRateBps;
    }

    function setCharityMintRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        lastCharityMintRate = newRateBps;
    }

    function setOvercollateralizationTarget(uint256 newTarget18) external onlyGovernance {
        lastOvercollateralizationTarget = newTarget18;
    }

    function setAdminCanMintToCharity(bool enabled) external onlyGovernanceOrOwner {
        adminCanMintToCharity = enabled;
    }

    function pauseMinting() external onlyGovernanceOrOwner {
        mintingPaused = true;
    }

    function unpauseMinting() external onlyGovernanceOrOwner {
        mintingPaused = false;
    }

    function pauseRedemption() external onlyGovernanceOrOwner {
        redemptionPaused = true;
    }

    function unpauseRedemption() external onlyGovernanceOrOwner {
        redemptionPaused = false;
    }

    function pauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner {
        assetPaused[assetId] = true;
    }

    function unpauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner {
        assetPaused[assetId] = false;
    }

    function mintToCharity(uint256 amount) external onlyCharityMintAuthority {
        lastCharityMintAmount = amount;
        lastCharityMintCharityId = 0;
        lastCharityMintUsedDefault = true;
    }

    function mintToCharity(uint256 charityId, uint256 amount) external onlyCharityMintAuthority {
        lastCharityMintAmount = amount;
        lastCharityMintCharityId = charityId;
        lastCharityMintUsedDefault = false;
    }
}

contract MockLiquidityRouter is MockOwned {
    address public governance;
    address public treasuryController;
    address public reserveInputRouter;
    address public cplTcoin;
    address public charityPreferencesRegistry;
    address public acceptancePreferencesRegistry;
    address public poolRegistry;
    address public poolAdapter;
    uint256 public charityTopupBps;
    uint256 public weightLowMrTcoinLiquidity;
    uint256 public weightHighCplTcoinLiquidity;
    uint256 public weightUserPoolPreference;
    uint256 public weightUserMerchantPreference;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner) revert Unauthorized();
        _;
    }

    function setGovernance(address governance_) external onlyOwner {
        governance = governance_;
    }

    function setTreasuryController(address treasury_) external onlyGovernanceOrOwner {
        treasuryController = treasury_;
    }

    function setReserveInputRouter(address router_) external onlyGovernanceOrOwner {
        reserveInputRouter = router_;
    }

    function setCplTcoin(address cplTcoin_) external onlyGovernanceOrOwner {
        cplTcoin = cplTcoin_;
    }

    function setCharityPreferencesRegistry(address registry_) external onlyGovernanceOrOwner {
        charityPreferencesRegistry = registry_;
    }

    function setAcceptancePreferencesRegistry(address registry_) external onlyGovernanceOrOwner {
        acceptancePreferencesRegistry = registry_;
    }

    function setPoolRegistry(address registry_) external onlyGovernanceOrOwner {
        poolRegistry = registry_;
    }

    function setPoolAdapter(address adapter_) external onlyGovernanceOrOwner {
        poolAdapter = adapter_;
    }

    function setCharityTopupBps(uint256 newBps) external onlyGovernanceOrOwner {
        charityTopupBps = newBps;
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
    }
}

contract MockTcoin is MockOwned {
    uint256 public lastExpirePeriod;

    function setExpirePeriod(uint256 newExpirePeriod) external onlyOwner {
        lastExpirePeriod = newExpirePeriod;
    }
}

contract GovernanceDeadlineTest is Test {
    bytes32 private constant MERCHANT_ID = keccak256("merchant-a");
    bytes32 private constant POOL_ID = keccak256("pool-a");
    bytes32 private constant ASSET_ID = bytes32("USDC");

    Governance private governance;
    MockStewardRegistry private stewardRegistry;
    MockPoolRegistry private poolRegistry;
    MockTreasuryController private treasury;
    MockLiquidityRouter private router;
    MockTcoin private tcoin;
    GovernanceExecutionHelper private governanceExecutionHelper;
    GovernanceProposalHelper private governanceProposalHelperImplementation;
    GovernanceRouterProposalHelper private governanceRouterProposalHelperImplementation;

    address private steward = address(0x1001);

    function setUp() public {
        stewardRegistry = new MockStewardRegistry();
        MockCharityRegistry charity = new MockCharityRegistry();
        poolRegistry = new MockPoolRegistry();
        MockReserveRegistry reserve = new MockReserveRegistry();
        treasury = new MockTreasuryController();
        router = new MockLiquidityRouter();
        tcoin = new MockTcoin();
        governanceExecutionHelper = new GovernanceExecutionHelper();
        governanceProposalHelperImplementation = new GovernanceProposalHelper();
        governanceRouterProposalHelperImplementation = new GovernanceRouterProposalHelper();

        governance = new Governance(
            address(this),
            address(stewardRegistry),
            address(charity),
            address(poolRegistry),
            address(reserve),
            address(treasury),
            address(router),
            address(tcoin),
            address(governanceExecutionHelper),
            address(governanceProposalHelperImplementation),
            address(governanceRouterProposalHelperImplementation),
            1 days
        );

        stewardRegistry.setSteward(steward, 1);
    }

    function _wireGovernanceAsOwnerAndGovernance() internal {
        treasury.setGovernance(address(governance));
        router.setGovernance(address(governance));
        treasury.transferOwnership(address(governance));
        router.transferOwnership(address(governance));
        tcoin.transferOwnership(address(governance));
    }

    function _approveAndExecute(uint256 proposalId) internal {
        vm.prank(steward);
        governance.voteProposal(proposalId, true);

        vm.warp(block.timestamp + 1 days + 1);
        governance.executeProposal(proposalId);
    }

    function test_ExecuteProposalIsDeadlineGated() public {
        _wireGovernanceAsOwnerAndGovernance();

        vm.prank(steward);
        uint256 proposalId = GovernanceProposalHelper(address(governance)).proposeUserRedeemRateUpdate(9000, 1 days);

        vm.prank(steward);
        governance.voteProposal(proposalId, true);

        vm.expectRevert();
        governance.executeProposal(proposalId);

        vm.warp(block.timestamp + 1 days + 1);
        governance.executeProposal(proposalId);

        assertEq(treasury.lastUserRate(), 9000);
    }

    function test_ExecuteOvercollateralizationTargetUpdateAfterDeadline() public {
        _wireGovernanceAsOwnerAndGovernance();

        vm.prank(steward);
        uint256 proposalId =
            GovernanceProposalHelper(address(governance)).proposeOvercollateralizationTargetUpdate(11e17, 1 days);

        _approveAndExecute(proposalId);

        assertEq(treasury.lastOvercollateralizationTarget(), 11e17);
    }

    function test_ExecuteCharityMintProposalSupportsDefaultAndSpecifiedTargets() public {
        _wireGovernanceAsOwnerAndGovernance();

        vm.prank(steward);
        uint256 defaultProposalId =
            GovernanceProposalHelper(address(governance)).proposeMintToDefaultCharity(50e18, 1 days);

        _approveAndExecute(defaultProposalId);

        assertEq(treasury.lastCharityMintAmount(), 50e18);
        assertEq(treasury.lastCharityMintCharityId(), 0);
        assertTrue(treasury.lastCharityMintUsedDefault());

        vm.prank(steward);
        uint256 specificProposalId =
            GovernanceProposalHelper(address(governance)).proposeMintToCharity(7, 25e18, 1 days);

        _approveAndExecute(specificProposalId);

        assertEq(treasury.lastCharityMintAmount(), 25e18);
        assertEq(treasury.lastCharityMintCharityId(), 7);
        assertFalse(treasury.lastCharityMintUsedDefault());
    }

    function test_ExecuteMerchantApprovalCarriesMerchantEntityPayload() public {
        address[] memory wallets = new address[](2);
        wallets[0] = address(0xAA01);
        wallets[1] = address(0xAA02);

        vm.prank(steward);
        uint256 proposalId = GovernanceProposalHelper(address(governance))
            .proposeMerchantApprove(MERCHANT_ID, POOL_ID, "merchant-metadata", wallets, 1 days);

        _approveAndExecute(proposalId);

        assertEq(poolRegistry.lastApprovedMerchantId(), MERCHANT_ID);
        assertEq(poolRegistry.lastApprovedPoolId(), POOL_ID);
        assertEq(poolRegistry.lastApprovedMetadataRecordId(), "merchant-metadata");

        address[] memory recordedWallets = poolRegistry.getLastInitialWallets();
        assertEq(recordedWallets.length, 2);
        assertEq(recordedWallets[0], wallets[0]);
        assertEq(recordedWallets[1], wallets[1]);
    }

    function test_ExecuteExpirePeriodUpdateCallsTokenSurface() public {
        _wireGovernanceAsOwnerAndGovernance();

        vm.prank(steward);
        uint256 proposalId = GovernanceProposalHelper(address(governance)).proposeExpirePeriodUpdate(30 days, 1 days);

        _approveAndExecute(proposalId);

        assertEq(tcoin.lastExpirePeriod(), 30 days);
    }

    function test_ExecuteTreasuryAndRouterAdminProposalsAgainstFinalSignatures() public {
        _wireGovernanceAsOwnerAndGovernance();

        vm.prank(steward);
        uint256 setRouterProposalId = GovernanceProposalHelper(address(governance))
            .proposeTreasuryControllerSetLiquidityRouter(address(0xBEEF), 1 days);
        _approveAndExecute(setRouterProposalId);
        assertEq(treasury.liquidityRouter(), address(0xBEEF));

        vm.prank(steward);
        uint256 pauseAssetProposalId =
            GovernanceProposalHelper(address(governance)).proposeTreasuryControllerPauseAsset(ASSET_ID, 1 days);
        _approveAndExecute(pauseAssetProposalId);
        assertTrue(treasury.assetPaused(ASSET_ID));

        vm.prank(steward);
        uint256 adminMintToggleProposalId =
            GovernanceProposalHelper(address(governance)).proposeSetAdminCanMintToCharity(false, 1 days);
        _approveAndExecute(adminMintToggleProposalId);
        assertFalse(treasury.adminCanMintToCharity());

        vm.prank(steward);
        uint256 topupProposalId =
            GovernanceRouterProposalHelper(address(governance)).proposeLiquidityRouterSetCharityTopupBps(450, 1 days);
        _approveAndExecute(topupProposalId);
        assertEq(router.charityTopupBps(), 450);

        vm.prank(steward);
        uint256 acceptanceRegistryProposalId = GovernanceRouterProposalHelper(address(governance))
            .proposeLiquidityRouterSetAcceptancePreferencesRegistry(address(0xA11CE), 1 days);
        _approveAndExecute(acceptanceRegistryProposalId);
        assertEq(router.acceptancePreferencesRegistry(), address(0xA11CE));

        vm.prank(steward);
        uint256 reserveInputRouterProposalId = GovernanceRouterProposalHelper(address(governance))
            .proposeLiquidityRouterSetReserveInputRouter(address(0xDADA), 1 days);
        _approveAndExecute(reserveInputRouterProposalId);
        assertEq(router.reserveInputRouter(), address(0xDADA));

        vm.prank(steward);
        uint256 scoringProposalId = GovernanceRouterProposalHelper(address(governance))
            .proposeLiquidityRouterSetScoringWeights(11, 22, 33, 44, 1 days);
        _approveAndExecute(scoringProposalId);

        assertEq(router.weightLowMrTcoinLiquidity(), 11);
        assertEq(router.weightHighCplTcoinLiquidity(), 22);
        assertEq(router.weightUserPoolPreference(), 33);
        assertEq(router.weightUserMerchantPreference(), 44);
    }

    function test_ExecuteTreasuryGovernanceProposalRevertsWhenGovernanceNotConfigured() public {
        treasury.transferOwnership(address(governance));

        vm.prank(steward);
        uint256 proposalId =
            GovernanceProposalHelper(address(governance)).proposeOvercollateralizationTargetUpdate(11e17, 1 days);

        vm.prank(steward);
        governance.voteProposal(proposalId, true);

        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(MockOwned.Unauthorized.selector);
        governance.executeProposal(proposalId);
    }

    function test_ExecuteRouterOwnerProposalRevertsWhenGovernanceIsNotOwner() public {
        router.setGovernance(address(governance));

        vm.prank(steward);
        uint256 proposalId = GovernanceRouterProposalHelper(address(governance))
            .proposeLiquidityRouterSetGovernance(address(0xCAFE), 1 days);

        vm.prank(steward);
        governance.voteProposal(proposalId, true);

        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(MockOwned.Unauthorized.selector);
        governance.executeProposal(proposalId);
    }
}
