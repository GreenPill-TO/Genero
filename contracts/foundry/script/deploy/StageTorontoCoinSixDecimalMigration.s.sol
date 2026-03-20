// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/console2.sol";
import {GeneroTokenV3} from "../../src/torontocoin/GeneroTokenV3.sol";
import {ManagedPoolAdapter} from "../../src/torontocoin/ManagedPoolAdapter.sol";
import {TorontoCoinSixDecimalMigrationBase} from "./TorontoCoinSixDecimalMigrationBase.s.sol";

contract StageTorontoCoinSixDecimalMigration is TorontoCoinSixDecimalMigrationBase {
    uint256 internal constant _SEEDED_POOL_AMOUNT = 1_000e6;
    uint256 internal constant _SMOKE_INPUT_AMOUNT = 1e6;
    uint64 internal constant _DEFAULT_VOTING_WINDOW = 90;

    function run() external returns (MigrationArtifact memory artifact) {
        ChainSelection memory selection = _assertCeloMainnet();
        _requireFreshArtifact();

        artifact = _defaultArtifact();

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        string memory mrName = _chainConfigString(selection, ".torontocoin.tokens.mrTcoin.name");
        string memory mrSymbol = _chainConfigString(selection, ".torontocoin.tokens.mrTcoin.symbol");
        uint8 mrDecimals = uint8(_chainConfigUint(selection, ".torontocoin.tokens.mrTcoin.decimals"));
        int128 mrDecayLevel = int128(int256(_chainConfigUint(selection, ".torontocoin.tokens.mrTcoin.decayLevel")));
        uint256 mrPeriodMinutes = _chainConfigUint(selection, ".torontocoin.tokens.mrTcoin.periodMinutes");
        uint16 mrDefaultMerchantFeeBps =
            uint16(_chainConfigUint(selection, ".torontocoin.tokens.mrTcoin.defaultMerchantFeeBps"));

        string memory cplName = _chainConfigString(selection, ".torontocoin.tokens.cplTcoin.name");
        string memory cplSymbol = _chainConfigString(selection, ".torontocoin.tokens.cplTcoin.symbol");
        uint8 cplDecimals = uint8(_chainConfigUint(selection, ".torontocoin.tokens.cplTcoin.decimals"));
        int128 cplDecayLevel = int128(int256(_chainConfigUint(selection, ".torontocoin.tokens.cplTcoin.decayLevel")));
        uint256 cplPeriodMinutes = _chainConfigUint(selection, ".torontocoin.tokens.cplTcoin.periodMinutes");
        uint16 cplDefaultMerchantFeeBps =
            uint16(_chainConfigUint(selection, ".torontocoin.tokens.cplTcoin.defaultMerchantFeeBps"));

        ManagedPoolAdapter.PoolConfig memory currentPoolConfig =
            ManagedPoolAdapter(_LIVE_MANAGED_POOL_ADAPTER).getPoolConfig(_BOOTSTRAP_POOL_ID);

        vm.startBroadcast(privateKey);

        GeneroTokenV3 newMrTcoin = new GeneroTokenV3(
            mrName,
            mrSymbol,
            mrDecimals,
            mrDecayLevel,
            mrPeriodMinutes,
            _LIVE_TREASURY,
            artifact.poolRegistry,
            artifact.charityPreferencesRegistry,
            mrDefaultMerchantFeeBps
        );
        GeneroTokenV3 newCplTcoin = new GeneroTokenV3(
            cplName,
            cplSymbol,
            cplDecimals,
            cplDecayLevel,
            cplPeriodMinutes,
            _LIVE_TREASURY,
            artifact.poolRegistry,
            artifact.charityPreferencesRegistry,
            cplDefaultMerchantFeeBps
        );
        ManagedPoolAdapter newManagedPoolAdapter = new ManagedPoolAdapter(
            deployer, artifact.governance, artifact.poolRegistry, address(newMrTcoin), address(newCplTcoin)
        );

        newMrTcoin.addWriter(artifact.treasuryController);
        newCplTcoin.addWriter(artifact.liquidityRouter);
        newCplTcoin.addWriter(deployer);

        newManagedPoolAdapter.createPoolAccount(_BOOTSTRAP_POOL_ID);
        newManagedPoolAdapter.setPoolQuoteBps(_BOOTSTRAP_POOL_ID, currentPoolConfig.quoteBps);
        newManagedPoolAdapter.setPoolExecutionEnabled(_BOOTSTRAP_POOL_ID, currentPoolConfig.executionEnabled);

        vm.stopBroadcast();

        artifact.newMrTcoin = address(newMrTcoin);
        artifact.newCplTcoin = address(newCplTcoin);
        artifact.newManagedPoolAdapter = address(newManagedPoolAdapter);
        artifact.newPoolAccount = newManagedPoolAdapter.getPoolAccount(_BOOTSTRAP_POOL_ID);
        artifact.votingWindow = _DEFAULT_VOTING_WINDOW;
        artifact.stagedAt = block.timestamp;
        artifact.seededAmount = _SEEDED_POOL_AMOUNT;
        artifact.smokeInputAmount = _SMOKE_INPUT_AMOUNT;

        _writeArtifact(artifact);

        console2.log("Staged six-decimal migration on Celo mainnet");
        console2.log("new mrTCOIN", artifact.newMrTcoin);
        console2.log("new cplTCOIN", artifact.newCplTcoin);
        console2.log("new adapter", artifact.newManagedPoolAdapter);
        console2.log("new pool account", artifact.newPoolAccount);
    }
}
