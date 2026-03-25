// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import {LiquidityRouter} from "../../src/torontocoin/LiquidityRouter.sol";
import {MentoBrokerSwapAdapter} from "../../src/torontocoin/MentoBrokerSwapAdapter.sol";
import {PoolRegistry} from "../../src/torontocoin/PoolRegistry.sol";
import {ReserveInputRouter} from "../../src/torontocoin/ReserveInputRouter.sol";
import {ReserveRegistry} from "../../src/torontocoin/ReserveRegistry.sol";
import {SarafuSwapPoolAdapter} from "../../src/torontocoin/SarafuSwapPoolAdapter.sol";
import {StaticCadOracle} from "../../src/torontocoin/StaticCadOracle.sol";
import {Treasury} from "../../src/torontocoin/Treasury.sol";
import {TreasuryController} from "../../src/torontocoin/TreasuryController.sol";
import {GeneroTokenV3} from "../../src/torontocoin/GeneroTokenV3.sol";
import {Governance} from "../../src/torontocoin/Governance.sol";
import {SwapPool} from "../../src/sarafu-read-only/SwapPool.sol";
import "../helpers/DeployChainConfig.sol";

contract ValidateTorontoCoinDeployment is DeployChainConfig {
    using stdJson for string;

    error MissingDeploymentArtifact(string path);
    error ValidationFailed(string reason);

    uint256 private constant SWAP_POOL_FEE_DENOMINATOR = 1_000_000;

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
        address tokenUniqueSymbolIndex = suite.readAddress(".tokenUniqueSymbolIndex");
        address limiter = suite.readAddress(".limiter");
        address priceIndexQuoter = suite.readAddress(".priceIndexQuoter");
        address bootstrapSwapPool = suite.readAddress(".bootstrapSwapPool");
        address sarafuSwapPoolAdapter = suite.readAddress(".sarafuSwapPoolAdapter");
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
        address configuredUsdmToken =
            mentoEnabled ? _chainConfigAddress(selection, ".torontocoin.mento.usdmToken") : address(0);

        bytes32 reserveAssetId = wiring.readBytes32(".reserveAssetId");
        bytes32 bootstrapPoolId = wiring.readBytes32(".bootstrapPoolId");
        bytes32 bootstrapMerchantId = wiring.readBytes32(".bootstrapMerchantId");
        address scenarioBuyer =
            _chainConfigAddressOrDefault(selection, ".torontocoin.scenarioB.buyer", suite.readAddress(".tokenAdmin"));
        uint256 scenarioInputAmount = _chainConfigUint(selection, ".torontocoin.scenarioB.inputAmount");

        if (
            governance == address(0) || governanceExecutionHelper == address(0)
                || governanceProposalHelper == address(0) || governanceRouterProposalHelper == address(0)
                || treasuryController == address(0) || treasury == address(0) || poolRegistry == address(0)
                || charityRegistry == address(0) || reserveRegistry == address(0) || oracleRouter == address(0)
                || tokenUniqueSymbolIndex == address(0) || limiter == address(0) || priceIndexQuoter == address(0)
                || bootstrapSwapPool == address(0) || sarafuSwapPoolAdapter == address(0)
                || reserveSwapAdapter == address(0) || reserveInputRouter == address(0) || liquidityRouter == address(0)
                || mrTcoin == address(0) || cplTcoin == address(0) || staticCadOracle == address(0)
                || stewardRegistry == address(0) || userCharityPreferencesRegistry == address(0)
                || userAcceptancePreferencesRegistry == address(0) || reserveAssetToken == address(0)
                || scenarioInputToken == address(0)
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
        if (SarafuSwapPoolAdapter(sarafuSwapPoolAdapter).governance() != governance) {
            revert ValidationFailed("sarafu swap pool adapter governance mismatch");
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
        if (address(LiquidityRouter(liquidityRouter).poolAdapter()) != sarafuSwapPoolAdapter) {
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

        if (PoolRegistry(poolRegistry).getPoolAddress(bootstrapPoolId) != bootstrapSwapPool) {
            revert ValidationFailed("bootstrap swap pool address mismatch");
        }

        (uint256 mrLiquidity, uint256 cplLiquidity, bool poolActive) =
            SarafuSwapPoolAdapter(sarafuSwapPoolAdapter).getPoolLiquidityState(bootstrapPoolId);
        if (!poolActive || cplLiquidity == 0) {
            revert ValidationFailed("bootstrap sarafu pool not ready");
        }

        bytes32[] memory merchantIds = new bytes32[](1);
        merchantIds[0] = bootstrapMerchantId;
        if (!SarafuSwapPoolAdapter(sarafuSwapPoolAdapter).poolMatchesAnyMerchantIds(bootstrapPoolId, merchantIds)) {
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
            if (!configured || usdcRouteProvider == address(0) || usdcFirstExchangeId == bytes32(0)) {
                revert ValidationFailed("mento usdc route missing");
            }

            if (reserveAssetToken == configuredUsdmToken) {
                if (usdmToken != address(0) || secondProvider != address(0) || secondExchangeId != bytes32(0)) {
                    revert ValidationFailed("mento usdc direct route expected");
                }
            } else {
                if (usdmToken == address(0) || secondProvider == address(0) || secondExchangeId == bytes32(0)) {
                    revert ValidationFailed("mento usdc multihop route not configured");
                }
            }
        }

        if (StaticCadOracle(staticCadOracle).latestAnswer() <= 0) {
            revert ValidationFailed("static cad oracle invalid");
        }

        (bytes32 scenarioPoolId,,, uint256 scenarioMrTcoinOut,,,,) = LiquidityRouter(liquidityRouter)
            .previewBuyCplTcoin(bootstrapPoolId, scenarioBuyer, scenarioInputToken, scenarioInputAmount);
        if (scenarioPoolId != bootstrapPoolId) {
            revert ValidationFailed("scenario preview selected unexpected pool");
        }

        uint256 scenarioQuotedOut = SwapPool(bootstrapSwapPool).getQuote(cplTcoin, mrTcoin, scenarioMrTcoinOut);
        uint256 scenarioFee = (scenarioQuotedOut * SwapPool(bootstrapSwapPool).feePpm()) / SWAP_POOL_FEE_DENOMINATOR;
        uint256 scenarioQuotedOutAfterFee = scenarioQuotedOut - scenarioFee;
        if (scenarioQuotedOutAfterFee > cplLiquidity) {
            revert ValidationFailed("bootstrap pool insufficient for configured scenario");
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
        vm.serializeUint(root, "bootstrapPoolMrLiquidity", mrLiquidity);
        vm.serializeUint(root, "bootstrapPoolCplLiquidity", cplLiquidity);
        vm.serializeUint(root, "scenarioInputAmount", scenarioInputAmount);
        vm.serializeUint(root, "scenarioPreviewMrTcoinOut", scenarioMrTcoinOut);
        vm.serializeUint(root, "scenarioRequiredCplLiquidity", scenarioQuotedOutAfterFee);
        vm.serializeBool(root, "scenarioPoolLiquiditySufficient", true);
        vm.serializeBool(root, "mentoEnabled", mentoEnabled);
        string memory json = vm.serializeBool(root, "mentoUsdcRouteConfigured", mentoEnabled);
        vm.writeJson(json, string.concat(deploymentDir, "/validation.json"));
    }
}
