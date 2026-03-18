// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Governance} from "../../../src/torontocoin/Governance.sol";

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
    function addPool(bytes32, string calldata, string calldata) external pure {}
    function removePool(bytes32) external pure {}
    function suspendPool(bytes32) external pure {}
    function unsuspendPool(bytes32) external pure {}
    function approveMerchant(bytes32, bytes32, string calldata, address[] calldata) external pure {}
    function removeMerchant(bytes32) external pure {}
    function suspendMerchant(bytes32) external pure {}
    function unsuspendMerchant(bytes32) external pure {}
    function reassignMerchantPool(bytes32, bytes32) external pure {}
}

contract MockReserveRegistry {
    function addReserveAsset(bytes32, address, string calldata, uint8, address, address, uint256) external pure {}
    function removeReserveAsset(bytes32) external pure {}
    function pauseReserveAsset(bytes32) external pure {}
    function unpauseReserveAsset(bytes32) external pure {}
    function updateReserveAssetOracles(bytes32, address, address) external pure {}
    function updateReserveAssetStaleness(bytes32, uint256) external pure {}
}

contract MockTreasuryController {
    uint256 public cadPeg18 = 1e18;
    uint256 public lastUserRate;
    uint256 public lastOvercollateralizationTarget;
    uint256 public lastCharityMintAmount;
    uint256 public lastCharityMintCharityId;
    bool public lastCharityMintUsedDefault;

    function setCadPeg(uint256 newCadPeg18) external {
        cadPeg18 = newCadPeg18;
    }

    function setUserRedeemRate(uint256 newRateBps) external {
        lastUserRate = newRateBps;
    }

    function setMerchantRedeemRate(uint256) external pure {}
    function setCharityMintRate(uint256) external pure {}

    function setOvercollateralizationTarget(uint256 newTarget18) external {
        lastOvercollateralizationTarget = newTarget18;
    }

    function mintToCharity(uint256 amount) external {
        lastCharityMintAmount = amount;
        lastCharityMintCharityId = 0;
        lastCharityMintUsedDefault = true;
    }

    function mintToCharity(uint256 charityId, uint256 amount) external {
        lastCharityMintAmount = amount;
        lastCharityMintCharityId = charityId;
        lastCharityMintUsedDefault = false;
    }
}

contract MockTcoin {
    uint256 public lastExpirePeriod;

    function setExpirePeriod(uint256 newExpirePeriod) external {
        lastExpirePeriod = newExpirePeriod;
    }
}

contract GovernanceDeadlineTest is Test {
    Governance private governance;
    MockStewardRegistry private stewardRegistry;
    MockTreasuryController private treasury;

    address private steward = address(0x1001);

    function setUp() public {
        stewardRegistry = new MockStewardRegistry();
        MockCharityRegistry charity = new MockCharityRegistry();
        MockPoolRegistry pool = new MockPoolRegistry();
        MockReserveRegistry reserve = new MockReserveRegistry();
        treasury = new MockTreasuryController();
        MockTcoin tcoin = new MockTcoin();

        governance = new Governance(
            address(this),
            address(stewardRegistry),
            address(charity),
            address(pool),
            address(reserve),
            address(treasury),
            address(tcoin),
            1 days
        );

        stewardRegistry.setSteward(steward, 1);
    }

    function test_ExecuteProposalIsDeadlineGated() public {
        vm.prank(steward);
        uint256 proposalId = governance.proposeUserRedeemRateUpdate(9000, 1 days);

        vm.prank(steward);
        governance.voteProposal(proposalId, true);

        vm.expectRevert();
        governance.executeProposal(proposalId);

        vm.warp(block.timestamp + 1 days + 1);
        governance.executeProposal(proposalId);

        assertEq(treasury.lastUserRate(), 9000);
    }

    function test_ExecuteOvercollateralizationTargetUpdateAfterDeadline() public {
        vm.prank(steward);
        uint256 proposalId = governance.proposeOvercollateralizationTargetUpdate(11e17, 1 days);

        vm.prank(steward);
        governance.voteProposal(proposalId, true);

        vm.warp(block.timestamp + 1 days + 1);
        governance.executeProposal(proposalId);

        assertEq(treasury.lastOvercollateralizationTarget(), 11e17);
    }

    function test_ExecuteCharityMintProposalSupportsDefaultAndSpecifiedTargets() public {
        vm.prank(steward);
        uint256 defaultProposalId = governance.proposeMintToDefaultCharity(50e18, 1 days);

        vm.prank(steward);
        governance.voteProposal(defaultProposalId, true);

        vm.warp(block.timestamp + 1 days + 1);
        governance.executeProposal(defaultProposalId);

        assertEq(treasury.lastCharityMintAmount(), 50e18);
        assertEq(treasury.lastCharityMintCharityId(), 0);
        assertTrue(treasury.lastCharityMintUsedDefault());

        vm.prank(steward);
        uint256 specificProposalId = governance.proposeMintToCharity(7, 25e18, 1 days);

        vm.prank(steward);
        governance.voteProposal(specificProposalId, true);

        vm.warp(block.timestamp + 1 days + 2);
        governance.executeProposal(specificProposalId);

        assertEq(treasury.lastCharityMintAmount(), 25e18);
        assertEq(treasury.lastCharityMintCharityId(), 7);
        assertFalse(treasury.lastCharityMintUsedDefault());
    }
}
