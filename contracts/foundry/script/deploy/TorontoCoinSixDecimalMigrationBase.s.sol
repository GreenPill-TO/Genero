// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import {DeployChainConfig} from "../helpers/DeployChainConfig.sol";

abstract contract TorontoCoinSixDecimalMigrationBase is Script, DeployChainConfig {
    using stdJson for string;

    string internal constant _ARTIFACT_PATH = "deployments/torontocoin/celo-mainnet/six-decimal-migration.json";
    string internal constant _ARTIFACT_DIR = "deployments/torontocoin/celo-mainnet";

    address internal constant _LIVE_GOVERNANCE = 0x8cBd51D726d7D8851bdD3aC003c0Fb20c26ef6E1;
    address internal constant _LIVE_TREASURY_CONTROLLER = 0x4AAf282aE14A437163d9D8fDD44aAcD4fB65244c;
    address internal constant _LIVE_TREASURY = 0x1E70DefF977364322Da73Ad1caa868620d33ab82;
    address internal constant _LIVE_LIQUIDITY_ROUTER = 0xFe3aE3c1f9EDDbF74472587893a7f8B84e20D748;
    address internal constant _LIVE_MANAGED_POOL_ADAPTER = 0xD2Ef61a2Cc17F44e5b5E41bE0F52a0DBa70Ffdf0;
    address internal constant _LIVE_MR_TCOIN = 0x481513d51550e48A2cB0e3bD9bFb5fdE97FBA832;
    address internal constant _LIVE_CPL_TCOIN = 0x3fBcBA716c9C2Bb230Ed02d2C41A93C71c8243DD;
    address internal constant _LIVE_POOL_REGISTRY = 0x6a376E35dA005A716f41109FDe7517A7b1F48222;
    address internal constant _LIVE_CHARITY_PREFERENCES_REGISTRY = 0xB4B4104Cff175A15E1BA70AE974068043d18b20B;
    address internal constant _LIVE_RESERVE_INPUT_ROUTER = 0xA0F335a1E1F8b904AEEedA978DC0A78923c0336b;
    address internal constant _LIVE_USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;

    bytes32 internal constant _BOOTSTRAP_POOL_ID = 0x746f726f6e746f2d67656e657369732d706f6f6c000000000000000000000000;

    struct MigrationArtifact {
        address governance;
        address treasuryController;
        address liquidityRouter;
        address managedPoolAdapter;
        address mrTcoin;
        address cplTcoin;
        address poolRegistry;
        address charityPreferencesRegistry;
        address reserveInputRouter;
        address usdcToken;
        bytes32 bootstrapPoolId;
        address newMrTcoin;
        address newCplTcoin;
        address newManagedPoolAdapter;
        address newPoolAccount;
        uint256 treasuryControllerSetTcoinTokenProposalId;
        uint256 liquidityRouterSetCplTcoinProposalId;
        uint256 liquidityRouterSetPoolAdapterProposalId;
        uint256 votingWindow;
        uint256 stagedAt;
        uint256 proposedAt;
        uint256 executedAt;
        uint256 cancelledAt;
        uint256 seededAmount;
        uint256 smokeInputAmount;
        uint256 smokeReserveAmountOut;
        uint256 smokeMrTcoinOut;
        uint256 smokeCplTcoinOut;
        uint256 smokeCharityTopupOut;
        bytes32 smokeSelectedPoolId;
        uint256 smokeBuyerCplBalanceAfter;
        uint256 smokePoolMrBalanceAfter;
        uint256 smokePoolCplBalanceAfter;
    }

    error UnsupportedTarget(string target);
    error MissingArtifact(string path);
    error ExistingArtifact(string path);
    error DeprecatedManagedPoolMigration();

    function _assertCeloMainnet() internal view returns (ChainSelection memory selection) {
        selection = _assertDeployTargetChain();
        if (!_sameString(selection.target, "celo-mainnet")) {
            revert UnsupportedTarget(selection.target);
        }
    }

    function _defaultArtifact() internal pure returns (MigrationArtifact memory artifact) {
        artifact.governance = _LIVE_GOVERNANCE;
        artifact.treasuryController = _LIVE_TREASURY_CONTROLLER;
        artifact.liquidityRouter = _LIVE_LIQUIDITY_ROUTER;
        artifact.managedPoolAdapter = _LIVE_MANAGED_POOL_ADAPTER;
        artifact.mrTcoin = _LIVE_MR_TCOIN;
        artifact.cplTcoin = _LIVE_CPL_TCOIN;
        artifact.poolRegistry = _LIVE_POOL_REGISTRY;
        artifact.charityPreferencesRegistry = _LIVE_CHARITY_PREFERENCES_REGISTRY;
        artifact.reserveInputRouter = _LIVE_RESERVE_INPUT_ROUTER;
        artifact.usdcToken = _LIVE_USDC;
        artifact.bootstrapPoolId = _BOOTSTRAP_POOL_ID;
    }

    function _readArtifact() internal view returns (MigrationArtifact memory artifact) {
        if (!vm.exists(_ARTIFACT_PATH)) revert MissingArtifact(_ARTIFACT_PATH);
        string memory json = vm.readFile(_ARTIFACT_PATH);

        artifact.governance = json.readAddress(".governance");
        artifact.treasuryController = json.readAddress(".treasuryController");
        artifact.liquidityRouter = json.readAddress(".liquidityRouter");
        artifact.managedPoolAdapter = json.readAddress(".managedPoolAdapter");
        artifact.mrTcoin = json.readAddress(".mrTcoin");
        artifact.cplTcoin = json.readAddress(".cplTcoin");
        artifact.poolRegistry = json.readAddress(".poolRegistry");
        artifact.charityPreferencesRegistry = json.readAddress(".charityPreferencesRegistry");
        artifact.reserveInputRouter = json.readAddress(".reserveInputRouter");
        artifact.usdcToken = json.readAddress(".usdcToken");
        artifact.bootstrapPoolId = json.readBytes32(".bootstrapPoolId");
        artifact.newMrTcoin = json.readAddress(".newMrTcoin");
        artifact.newCplTcoin = json.readAddress(".newCplTcoin");
        artifact.newManagedPoolAdapter = json.readAddress(".newManagedPoolAdapter");
        artifact.newPoolAccount = json.readAddress(".newPoolAccount");
        artifact.treasuryControllerSetTcoinTokenProposalId =
            _readUintOrZero(json, ".treasuryControllerSetTcoinTokenProposalId");
        artifact.liquidityRouterSetCplTcoinProposalId = _readUintOrZero(json, ".liquidityRouterSetCplTcoinProposalId");
        artifact.liquidityRouterSetPoolAdapterProposalId =
            _readUintOrZero(json, ".liquidityRouterSetPoolAdapterProposalId");
        artifact.votingWindow = _readUintOrZero(json, ".votingWindow");
        artifact.stagedAt = _readUintOrZero(json, ".stagedAt");
        artifact.proposedAt = _readUintOrZero(json, ".proposedAt");
        artifact.executedAt = _readUintOrZero(json, ".executedAt");
        artifact.cancelledAt = _readUintOrZero(json, ".cancelledAt");
        artifact.seededAmount = _readUintOrZero(json, ".seededAmount");
        artifact.smokeInputAmount = _readUintOrZero(json, ".smokeInputAmount");
        artifact.smokeReserveAmountOut = _readUintOrZero(json, ".smokeReserveAmountOut");
        artifact.smokeMrTcoinOut = _readUintOrZero(json, ".smokeMrTcoinOut");
        artifact.smokeCplTcoinOut = _readUintOrZero(json, ".smokeCplTcoinOut");
        artifact.smokeCharityTopupOut = _readUintOrZero(json, ".smokeCharityTopupOut");
        artifact.smokeSelectedPoolId = _readBytes32OrZero(json, ".smokeSelectedPoolId");
        artifact.smokeBuyerCplBalanceAfter = _readUintOrZero(json, ".smokeBuyerCplBalanceAfter");
        artifact.smokePoolMrBalanceAfter = _readUintOrZero(json, ".smokePoolMrBalanceAfter");
        artifact.smokePoolCplBalanceAfter = _readUintOrZero(json, ".smokePoolCplBalanceAfter");
    }

    function _writeArtifact(MigrationArtifact memory artifact) internal {
        string memory root = "migration";
        vm.createDir(_ARTIFACT_DIR, true);
        vm.serializeAddress(root, "governance", artifact.governance);
        vm.serializeAddress(root, "treasuryController", artifact.treasuryController);
        vm.serializeAddress(root, "liquidityRouter", artifact.liquidityRouter);
        vm.serializeAddress(root, "managedPoolAdapter", artifact.managedPoolAdapter);
        vm.serializeAddress(root, "mrTcoin", artifact.mrTcoin);
        vm.serializeAddress(root, "cplTcoin", artifact.cplTcoin);
        vm.serializeAddress(root, "poolRegistry", artifact.poolRegistry);
        vm.serializeAddress(root, "charityPreferencesRegistry", artifact.charityPreferencesRegistry);
        vm.serializeAddress(root, "reserveInputRouter", artifact.reserveInputRouter);
        vm.serializeAddress(root, "usdcToken", artifact.usdcToken);
        vm.serializeBytes32(root, "bootstrapPoolId", artifact.bootstrapPoolId);
        vm.serializeAddress(root, "newMrTcoin", artifact.newMrTcoin);
        vm.serializeAddress(root, "newCplTcoin", artifact.newCplTcoin);
        vm.serializeAddress(root, "newManagedPoolAdapter", artifact.newManagedPoolAdapter);
        vm.serializeAddress(root, "newPoolAccount", artifact.newPoolAccount);
        vm.serializeUint(
            root, "treasuryControllerSetTcoinTokenProposalId", artifact.treasuryControllerSetTcoinTokenProposalId
        );
        vm.serializeUint(root, "liquidityRouterSetCplTcoinProposalId", artifact.liquidityRouterSetCplTcoinProposalId);
        vm.serializeUint(
            root, "liquidityRouterSetPoolAdapterProposalId", artifact.liquidityRouterSetPoolAdapterProposalId
        );
        vm.serializeUint(root, "votingWindow", artifact.votingWindow);
        vm.serializeUint(root, "stagedAt", artifact.stagedAt);
        vm.serializeUint(root, "proposedAt", artifact.proposedAt);
        vm.serializeUint(root, "executedAt", artifact.executedAt);
        vm.serializeUint(root, "cancelledAt", artifact.cancelledAt);
        vm.serializeUint(root, "seededAmount", artifact.seededAmount);
        vm.serializeUint(root, "smokeInputAmount", artifact.smokeInputAmount);
        vm.serializeUint(root, "smokeReserveAmountOut", artifact.smokeReserveAmountOut);
        vm.serializeUint(root, "smokeMrTcoinOut", artifact.smokeMrTcoinOut);
        vm.serializeUint(root, "smokeCplTcoinOut", artifact.smokeCplTcoinOut);
        vm.serializeUint(root, "smokeCharityTopupOut", artifact.smokeCharityTopupOut);
        vm.serializeBytes32(root, "smokeSelectedPoolId", artifact.smokeSelectedPoolId);
        vm.serializeUint(root, "smokeBuyerCplBalanceAfter", artifact.smokeBuyerCplBalanceAfter);
        vm.serializeUint(root, "smokePoolMrBalanceAfter", artifact.smokePoolMrBalanceAfter);
        string memory json = vm.serializeUint(root, "smokePoolCplBalanceAfter", artifact.smokePoolCplBalanceAfter);
        vm.writeJson(json, _ARTIFACT_PATH);
    }

    function _readUintOrZero(string memory json, string memory path) internal view returns (uint256 value) {
        try vm.parseJsonUint(json, path) returns (uint256 parsed) {
            return parsed;
        } catch {
            return 0;
        }
    }

    function _readBytes32OrZero(string memory json, string memory path) internal view returns (bytes32 value) {
        try vm.parseJsonBytes32(json, path) returns (bytes32 parsed) {
            return parsed;
        } catch {
            return bytes32(0);
        }
    }

    function _requireFreshArtifact() internal view {
        if (vm.exists(_ARTIFACT_PATH)) revert ExistingArtifact(_ARTIFACT_PATH);
    }

    function _revertDeprecatedManagedPoolMigration() internal pure {
        revert DeprecatedManagedPoolMigration();
    }
}
