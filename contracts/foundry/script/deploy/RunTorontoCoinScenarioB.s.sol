// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GeneroTokenV3} from "../../src/torontocoin/GeneroTokenV3.sol";
import {LiquidityRouter} from "../../src/torontocoin/LiquidityRouter.sol";
import "../helpers/DeployChainConfig.sol";

contract RunTorontoCoinScenarioB is DeployChainConfig {
    using stdJson for string;

    error MissingDeploymentArtifact(string path);

    function run() external {
        ChainSelection memory selection = _assertDeployTargetChain();
        string memory deploymentDir = string.concat("deployments/torontocoin/", selection.target);
        string memory suitePath = string.concat(deploymentDir, "/suite.json");
        if (!vm.exists(suitePath)) revert MissingDeploymentArtifact(suitePath);

        string memory suite = vm.readFile(suitePath);
        address liquidityRouter = suite.readAddress(".liquidityRouter");
        address cplTcoin = suite.readAddress(".cplTcoin");

        address inputToken = _chainConfigAddress(selection, ".torontocoin.mento.usdcToken");
        uint256 inputAmount = _chainConfigUint(selection, ".torontocoin.scenarioB.inputAmount");
        uint256 minReserveOut = _chainConfigUint(selection, ".torontocoin.scenarioB.minReserveOut");
        uint256 minCplTcoinOut = _chainConfigUint(selection, ".torontocoin.scenarioB.minCplTcoinOut");

        uint256 scenarioKey = _scenarioPrivateKey();
        address buyer = vm.addr(scenarioKey);

        (
            bytes32 selectedPoolId,
            bytes32 reserveAssetId,
            uint256 reserveAmountOut,
            uint256 mrTcoinOut,
            uint256 previewCplOut,
            uint256 previewCharityTopupOut,
            uint256 previewResolvedCharityId,
            address previewCharityWallet
        ) = LiquidityRouter(liquidityRouter).previewBuyCplTcoin(buyer, inputToken, inputAmount);

        uint256 cplBalanceBefore = GeneroTokenV3(cplTcoin).balanceOf(buyer);

        vm.startBroadcast(scenarioKey);
        IERC20(inputToken).approve(liquidityRouter, inputAmount);
        (
            bytes32 executedPoolId,
            bytes32 executedReserveAssetId,
            uint256 reserveAmountUsed,
            uint256 mrTcoinUsed,
            uint256 cplOut,
            uint256 charityTopupOut,
            uint256 resolvedCharityId
        ) = LiquidityRouter(liquidityRouter).buyCplTcoin(inputToken, inputAmount, minReserveOut, minCplTcoinOut);
        vm.stopBroadcast();

        uint256 cplBalanceAfter = GeneroTokenV3(cplTcoin).balanceOf(buyer);

        string memory root = "scenarioB";
        vm.serializeString(root, "target", selection.target);
        vm.serializeAddress(root, "buyer", buyer);
        vm.serializeAddress(root, "inputToken", inputToken);
        vm.serializeUint(root, "inputAmount", inputAmount);
        vm.serializeBytes32(root, "previewSelectedPoolId", selectedPoolId);
        vm.serializeBytes32(root, "previewReserveAssetId", reserveAssetId);
        vm.serializeUint(root, "previewReserveAmountOut", reserveAmountOut);
        vm.serializeUint(root, "previewMrTcoinOut", mrTcoinOut);
        vm.serializeUint(root, "previewCplTcoinOut", previewCplOut);
        vm.serializeUint(root, "previewCharityTopupOut", previewCharityTopupOut);
        vm.serializeUint(root, "previewResolvedCharityId", previewResolvedCharityId);
        vm.serializeAddress(root, "previewCharityWallet", previewCharityWallet);
        vm.serializeBytes32(root, "executedPoolId", executedPoolId);
        vm.serializeBytes32(root, "executedReserveAssetId", executedReserveAssetId);
        vm.serializeUint(root, "executedReserveAmountUsed", reserveAmountUsed);
        vm.serializeUint(root, "executedMrTcoinUsed", mrTcoinUsed);
        vm.serializeUint(root, "executedCplTcoinOut", cplOut);
        vm.serializeUint(root, "executedCharityTopupOut", charityTopupOut);
        vm.serializeUint(root, "executedResolvedCharityId", resolvedCharityId);
        vm.serializeUint(root, "cplBalanceBefore", cplBalanceBefore);
        string memory json = vm.serializeUint(root, "cplBalanceAfter", cplBalanceAfter);

        vm.writeJson(json, string.concat(deploymentDir, "/scenario-b-run.json"));
    }

    function _scenarioPrivateKey() internal view returns (uint256 privateKey) {
        try vm.envUint("SCENARIO_B_PRIVATE_KEY") returns (uint256 scenarioKey) {
            return scenarioKey;
        } catch {
            return vm.envUint("PRIVATE_KEY");
        }
    }
}
