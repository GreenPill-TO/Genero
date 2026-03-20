// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import {LiquidityRouter} from "../../src/torontocoin/LiquidityRouter.sol";
import {ManagedPoolAdapter} from "../../src/torontocoin/ManagedPoolAdapter.sol";
import {MentoBrokerSwapAdapter} from "../../src/torontocoin/MentoBrokerSwapAdapter.sol";
import {PoolRegistry} from "../../src/torontocoin/PoolRegistry.sol";
import {ReserveInputRouter} from "../../src/torontocoin/ReserveInputRouter.sol";
import {ReserveRegistry} from "../../src/torontocoin/ReserveRegistry.sol";
import {StaticCadOracle} from "../../src/torontocoin/StaticCadOracle.sol";
import {Treasury} from "../../src/torontocoin/Treasury.sol";
import {TreasuryController} from "../../src/torontocoin/TreasuryController.sol";
import {GeneroTokenV3} from "../../src/torontocoin/GeneroTokenV3.sol";
import {Governance} from "../../src/torontocoin/Governance.sol";
import "../helpers/DeployChainConfig.sol";

contract ValidateTorontoCoinDeployment is DeployChainConfig {
    using stdJson for string;

    error MissingDeploymentArtifact(string path);
    error ValidationFailed(string reason);

    function run() external {
        ChainSelection memory selection = _assertDeployTargetChain();
        string memory deploymentDir = string.concat("deployments/torontocoin/", selection.target);
        string memory suitePath = string.concat(deploymentDir, "/suite.json");
        string memory wiringPath = string.concat(deploymentDir, "/wiring.json");

        if (!vm.exists(suitePath)) revert MissingDeploymentArtifact(suitePath);
        if (!vm.exists(wiringPath)) revert MissingDeploymentArtifact(wiringPath);

        string memory suite = vm.readFile(suitePath);
        string memory wiring = vm.readFile(wiringPath);

        address governance = suite.readAddress(".governance");
        address governanceExecutionHelper = suite.readAddress(".governanceExecutionHelper");
        address governanceProposalHelper = suite.readAddress(".governanceProposalHelper");
        address governanceRouterProposalHelper = suite.readAddress(".governanceRouterProposalHelper");
        address treasuryController = suite.readAddress(".treasuryController");
        address treasury = suite.readAddress(".treasury");
        address poolRegistry = suite.readAddress(".poolRegistry");
        address charityRegistry = suite.readAddress(".charityRegistry");
        address reserveRegistry = suite.readAddress(".reserveRegistry");
        address oracleRouter = suite.readAddress(".oracleRouter");
        address managedPoolAdapter = suite.readAddress(".managedPoolAdapter");
        address reserveSwapAdapter = suite.readAddress(".reserveSwapAdapter");
        address mentoAdapter = suite.readAddress(".mentoBrokerSwapAdapter");
        address reserveInputRouter = suite.readAddress(".reserveInputRouter");
        address liquidityRouter = suite.readAddress(".liquidityRouter");
        address mrTcoin = suite.readAddress(".mrTcoin");
        address cplTcoin = suite.readAddress(".cplTcoin");
        address staticCadOracle = suite.readAddress(".staticCadOracle");
        address stewardRegistry = suite.readAddress(".stewardRegistry");
        address userCharityPreferencesRegistry = suite.readAddress(".userCharityPreferencesRegistry");
        address userAcceptancePreferencesRegistry = suite.readAddress(".userAcceptancePreferencesRegistry");
        address reserveAssetToken = suite.readAddress(".reserveAssetToken");
        address scenarioInputToken = suite.readAddress(".scenarioInputToken");
        bool mentoEnabled = _chainConfigBoolOr(selection, ".torontocoin.mento.enabled", true);

        bytes32 reserveAssetId = wiring.readBytes32(".reserveAssetId");
        bytes32 bootstrapPoolId = wiring.readBytes32(".bootstrapPoolId");
        bytes32 bootstrapMerchantId = wiring.readBytes32(".bootstrapMerchantId");

        if (
            governance == address(0) || governanceExecutionHelper == address(0)
                || governanceProposalHelper == address(0) || governanceRouterProposalHelper == address(0)
                || treasuryController == address(0) || treasury == address(0) || poolRegistry == address(0)
                || charityRegistry == address(0) || reserveRegistry == address(0) || oracleRouter == address(0)
                || managedPoolAdapter == address(0) || reserveSwapAdapter == address(0)
                || reserveInputRouter == address(0) || liquidityRouter == address(0) || mrTcoin == address(0)
                || cplTcoin == address(0) || staticCadOracle == address(0) || stewardRegistry == address(0)
                || userCharityPreferencesRegistry == address(0) || userAcceptancePreferencesRegistry == address(0)
                || reserveAssetToken == address(0) || scenarioInputToken == address(0)
        ) {
            revert ValidationFailed("zero address in suite artifact");
        }

        if (!Treasury(treasury).authorizedCallers(treasuryController)) {
            revert ValidationFailed("treasury controller not authorized in treasury");
        }

        if (TreasuryController(treasuryController).governance() != governance) {
            revert ValidationFailed("treasury controller governance mismatch");
        }
        if (LiquidityRouter(liquidityRouter).governance() != governance) {
            revert ValidationFailed("liquidity router governance mismatch");
        }
        if (ManagedPoolAdapter(managedPoolAdapter).governance() != governance) {
            revert ValidationFailed("managed pool adapter governance mismatch");
        }
        if (Governance(payable(governance)).executionHelper() != governanceExecutionHelper) {
            revert ValidationFailed("governance execution helper mismatch");
        }
        if (Governance(payable(governance)).proposalHelper() != governanceProposalHelper) {
            revert ValidationFailed("governance proposal helper mismatch");
        }
        if (Governance(payable(governance)).routerProposalHelper() != governanceRouterProposalHelper) {
            revert ValidationFailed("governance router proposal helper mismatch");
        }

        if (address(TreasuryController(treasuryController).treasury()) != treasury) {
            revert ValidationFailed("treasury pointer mismatch");
        }
        if (address(LiquidityRouter(liquidityRouter).treasuryController()) != treasuryController) {
            revert ValidationFailed("liquidity router treasury pointer mismatch");
        }
        if (address(LiquidityRouter(liquidityRouter).poolAdapter()) != managedPoolAdapter) {
            revert ValidationFailed("liquidity router adapter pointer mismatch");
        }
        if (address(ReserveInputRouter(reserveInputRouter).liquidityRouter()) != liquidityRouter) {
            revert ValidationFailed("reserve input router pointer mismatch");
        }

        if (!GeneroTokenV3(mrTcoin).isWriter(treasuryController)) {
            revert ValidationFailed("treasury controller missing mrTCOIN writer role");
        }
        if (!GeneroTokenV3(cplTcoin).isWriter(liquidityRouter)) {
            revert ValidationFailed("liquidity router missing cplTCOIN writer role");
        }
        if (GeneroTokenV3(mrTcoin).decimals() != 6) {
            revert ValidationFailed("mrTCOIN decimals must be 6");
        }
        if (GeneroTokenV3(cplTcoin).decimals() != 6) {
            revert ValidationFailed("cplTCOIN decimals must be 6");
        }

        if (!ReserveRegistry(reserveRegistry).isReserveAssetActive(reserveAssetId)) {
            revert ValidationFailed("reserve asset inactive");
        }
        if (!PoolRegistry(poolRegistry).isPoolActive(bootstrapPoolId)) {
            revert ValidationFailed("bootstrap pool inactive");
        }

        ManagedPoolAdapter.PoolConfig memory poolConfig =
            ManagedPoolAdapter(managedPoolAdapter).getPoolConfig(bootstrapPoolId);
        if (poolConfig.poolAccount == address(0) || poolConfig.quoteBps == 0 || !poolConfig.executionEnabled) {
            revert ValidationFailed("bootstrap pool config incomplete");
        }

        bytes32[] memory merchantIds = new bytes32[](1);
        merchantIds[0] = bootstrapMerchantId;
        if (!ManagedPoolAdapter(managedPoolAdapter).poolMatchesAnyMerchantIds(bootstrapPoolId, merchantIds)) {
            revert ValidationFailed("bootstrap merchant not linked to pool");
        }

        if (mentoEnabled) {
            if (mentoAdapter == address(0)) {
                revert ValidationFailed("mento adapter missing");
            }

            (
                address usdcRouteProvider,
                bytes32 usdcFirstExchangeId,
                address usdmToken,
                address secondProvider,
                bytes32 secondExchangeId,
                bool configured
            ) = MentoBrokerSwapAdapter(mentoAdapter)
                .getDefaultRouteConfig(_chainConfigAddress(selection, ".torontocoin.mento.usdcToken"));
            if (
                !configured || usdcRouteProvider == address(0) || usdcFirstExchangeId == bytes32(0)
                    || usdmToken == address(0) || secondProvider == address(0) || secondExchangeId == bytes32(0)
            ) {
                revert ValidationFailed("mento usdc route not configured");
            }
        }

        if (StaticCadOracle(staticCadOracle).latestAnswer() <= 0) {
            revert ValidationFailed("static cad oracle invalid");
        }

        string memory root = "validation";
        vm.serializeString(root, "target", selection.target);
        vm.serializeUint(root, "validatedAt", block.timestamp);
        vm.serializeBool(root, "treasuryAuthorizedCaller", true);
        vm.serializeBool(root, "governanceWiring", true);
        vm.serializeBool(root, "tokenWriterRoles", true);
        vm.serializeBool(root, "tokenDecimalsAreSix", true);
        vm.serializeBool(root, "reserveAssetActive", true);
        vm.serializeBool(root, "bootstrapPoolReady", true);
        vm.serializeBool(root, "mentoEnabled", mentoEnabled);
        string memory json = vm.serializeBool(root, "mentoUsdcRouteConfigured", mentoEnabled);
        vm.writeJson(json, string.concat(deploymentDir, "/validation.json"));
    }
}
