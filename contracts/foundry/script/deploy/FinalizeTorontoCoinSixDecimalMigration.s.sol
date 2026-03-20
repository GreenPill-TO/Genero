// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "forge-std/console2.sol";
import {GeneroTokenV3} from "../../src/torontocoin/GeneroTokenV3.sol";
import {LiquidityRouter} from "../../src/torontocoin/LiquidityRouter.sol";
import {ManagedPoolAdapter} from "../../src/torontocoin/ManagedPoolAdapter.sol";
import {TorontoCoinSixDecimalMigrationBase} from "./TorontoCoinSixDecimalMigrationBase.s.sol";

interface ITorontoCoinMigrationGovernanceExecutor {
    function executeProposal(uint256 proposalId) external;
    function setTcoinToken(address newToken) external;
}

contract FinalizeTorontoCoinSixDecimalMigration is TorontoCoinSixDecimalMigrationBase {
    uint256 internal constant _MIN_BPS = 9_500;

    error MissingStagedContracts();
    error MissingProposals();
    error InsufficientUsdcBalance(address account, uint256 required, uint256 actual);
    error PreviewReturnedZero();

    function run() external returns (MigrationArtifact memory artifact) {
        _assertCeloMainnet();
        artifact = _readArtifact();

        if (
            artifact.newMrTcoin == address(0) || artifact.newCplTcoin == address(0)
                || artifact.newManagedPoolAdapter == address(0) || artifact.newPoolAccount == address(0)
        ) {
            revert MissingStagedContracts();
        }
        if (
            artifact.treasuryControllerSetTcoinTokenProposalId == 0
                || artifact.liquidityRouterSetCplTcoinProposalId == 0
                || artifact.liquidityRouterSetPoolAdapterProposalId == 0
        ) {
            revert MissingProposals();
        }

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        IERC20 usdc = IERC20(artifact.usdcToken);
        uint256 usdcBalance = usdc.balanceOf(deployer);
        if (usdcBalance < artifact.smokeInputAmount) {
            revert InsufficientUsdcBalance(deployer, artifact.smokeInputAmount, usdcBalance);
        }

        ITorontoCoinMigrationGovernanceExecutor governance =
            ITorontoCoinMigrationGovernanceExecutor(artifact.governance);
        GeneroTokenV3 newCplTcoin = GeneroTokenV3(artifact.newCplTcoin);
        GeneroTokenV3 newMrTcoin = GeneroTokenV3(artifact.newMrTcoin);
        ManagedPoolAdapter newManagedPoolAdapter = ManagedPoolAdapter(artifact.newManagedPoolAdapter);
        LiquidityRouter liquidityRouter = LiquidityRouter(payable(artifact.liquidityRouter));

        vm.startBroadcast(privateKey);
        governance.executeProposal(artifact.treasuryControllerSetTcoinTokenProposalId);
        governance.executeProposal(artifact.liquidityRouterSetCplTcoinProposalId);
        governance.executeProposal(artifact.liquidityRouterSetPoolAdapterProposalId);
        governance.setTcoinToken(artifact.newMrTcoin);

        newCplTcoin.mintTo(artifact.newPoolAccount, artifact.seededAmount);
        newCplTcoin.deleteWriter(deployer);

        usdc.approve(address(liquidityRouter), 0);
        usdc.approve(address(liquidityRouter), artifact.smokeInputAmount);
        vm.stopBroadcast();

        (
            bytes32 selectedPoolId,
            bytes32 previewReserveAssetId,
            uint256 reserveAmountOut,
            uint256 mrTcoinOut,
            uint256 cplTcoinOut,
            uint256 previewCharityTopupOut,
            uint256 previewResolvedCharityId,
            address previewCharityWallet
        ) = liquidityRouter.previewBuyCplTcoin(
            _BOOTSTRAP_POOL_ID, deployer, artifact.usdcToken, artifact.smokeInputAmount
        );
        previewReserveAssetId;
        previewCharityTopupOut;
        previewResolvedCharityId;
        previewCharityWallet;

        if (reserveAmountOut == 0 || mrTcoinOut == 0 || cplTcoinOut == 0) revert PreviewReturnedZero();

        uint256 minReserveOut = (reserveAmountOut * _MIN_BPS) / 10_000;
        uint256 minCplTcoinOut = (cplTcoinOut * _MIN_BPS) / 10_000;

        vm.startBroadcast(privateKey);
        (
            bytes32 liveSelectedPoolId,
            bytes32 liveReserveAssetId,
            uint256 liveReserveAmountOut,
            uint256 liveMrTcoinOut,
            uint256 liveCplTcoinOut,
            uint256 liveCharityTopupOut,
            uint256 liveResolvedCharityId
        ) = liquidityRouter.buyCplTcoin(
            _BOOTSTRAP_POOL_ID, artifact.usdcToken, artifact.smokeInputAmount, minReserveOut, minCplTcoinOut
        );
        liveReserveAssetId;
        liveResolvedCharityId;
        newManagedPoolAdapter.transferOwnership(artifact.governance);
        vm.stopBroadcast();

        artifact.executedAt = block.timestamp;
        artifact.smokeSelectedPoolId = liveSelectedPoolId;
        artifact.smokeReserveAmountOut = liveReserveAmountOut;
        artifact.smokeMrTcoinOut = liveMrTcoinOut;
        artifact.smokeCplTcoinOut = liveCplTcoinOut;
        artifact.smokeCharityTopupOut = liveCharityTopupOut;
        artifact.smokeBuyerCplBalanceAfter = newCplTcoin.balanceOf(deployer);
        artifact.smokePoolMrBalanceAfter = newMrTcoin.balanceOf(artifact.newPoolAccount);
        artifact.smokePoolCplBalanceAfter = newCplTcoin.balanceOf(artifact.newPoolAccount);
        _writeArtifact(artifact);

        console2.log("Finalized six-decimal migration");
        console2.logBytes32(selectedPoolId);
        console2.log("reserve out", liveReserveAmountOut);
        console2.log("mrTCOIN out", liveMrTcoinOut);
        console2.log("cplTCOIN out", liveCplTcoinOut);
        console2.log("charity topup", liveCharityTopupOut);
        console2.log("buyer cpl balance", artifact.smokeBuyerCplBalanceAfter);
        console2.log("pool mr balance", artifact.smokePoolMrBalanceAfter);
        console2.log("pool cpl balance", artifact.smokePoolCplBalanceAfter);
    }
}
