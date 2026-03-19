// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {CharityRegistry} from "../../src/torontocoin/CharityRegistry.sol";
import {GeneroTokenV3} from "../../src/torontocoin/GeneroTokenV3.sol";
import {Governance} from "../../src/torontocoin/Governance.sol";
import {GovernanceExecutionHelper} from "../../src/torontocoin/GovernanceExecutionHelper.sol";
import {GovernanceProposalHelper} from "../../src/torontocoin/GovernanceProposalHelper.sol";
import {GovernanceRouterProposalHelper} from "../../src/torontocoin/GovernanceRouterProposalHelper.sol";
import {LiquidityRouter} from "../../src/torontocoin/LiquidityRouter.sol";
import {ManagedPoolAdapter} from "../../src/torontocoin/ManagedPoolAdapter.sol";
import {MentoBrokerSwapAdapter} from "../../src/torontocoin/MentoBrokerSwapAdapter.sol";
import {OracleRouter} from "../../src/torontocoin/OracleRouter.sol";
import {PoolRegistry} from "../../src/torontocoin/PoolRegistry.sol";
import {ReserveInputRouter} from "../../src/torontocoin/ReserveInputRouter.sol";
import {ReserveRegistry} from "../../src/torontocoin/ReserveRegistry.sol";
import {StaticCadOracle} from "../../src/torontocoin/StaticCadOracle.sol";
import {StewardRegistry} from "../../src/torontocoin/StewardRegistry.sol";
import {Treasury} from "../../src/torontocoin/Treasury.sol";
import {TreasuryController} from "../../src/torontocoin/TreasuryController.sol";
import {UserAcceptancePreferencesRegistry} from "../../src/torontocoin/UserAcceptancePreferencesRegistry.sol";
import {UserCharityPreferencesRegistry} from "../../src/torontocoin/UserCharityPreferencesRegistry.sol";
import "../helpers/DeployChainConfig.sol";

contract DeployTorontoCoinSuite is DeployChainConfig {
    uint256 internal constant MAX_GENERO_VISIBLE_AMOUNT = 0x7fffffffffffffff;

    struct DeploymentArtifacts {
        address reserveRegistryImplementation;
        address reserveRegistryProxy;
        address treasuryControllerImplementation;
        address treasuryControllerProxy;
        address stewardRegistryImplementation;
        address stewardRegistryProxy;
        address treasury;
        address charityRegistry;
        address poolRegistry;
        address oracleRouter;
        address userCharityPreferencesRegistry;
        address userAcceptancePreferencesRegistry;
        address mrTcoin;
        address cplTcoin;
        address staticCadOracle;
        address managedPoolAdapter;
        address mentoBrokerSwapAdapter;
        address reserveInputRouter;
        address liquidityRouter;
        address governance;
        address governanceExecutionHelper;
        address governanceProposalHelper;
        address governanceRouterProposalHelper;
    }

    error ConfigAmountExceedsGeneroTokenLimit(string key, uint256 amount, uint256 maxAmount);

    function run() external returns (DeploymentArtifacts memory artifacts) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        ChainSelection memory selection = _assertDeployTargetChain();

        address vaultOwner = _chainConfigAddressOrDefault(selection, ".roles.vaultOwner", deployer);
        address tokenAdmin = _chainConfigAddressOrDefault(selection, ".roles.tokenAdmin", deployer);
        address operationalIndexer = _chainConfigAddressOrDefault(selection, ".roles.operationalIndexer", deployer);
        bool governanceOwnsTokens = _chainConfigBool(selection, ".roles.governanceOwnsTokens");

        bytes32 cadmAssetId = _chainConfigBytes32(selection, ".torontocoin.reserves.cadm.assetId");
        address cadmToken = _chainConfigAddress(selection, ".torontocoin.reserves.cadm.token");
        string memory cadmCode = _chainConfigString(selection, ".torontocoin.reserves.cadm.code");
        uint8 cadmTokenDecimals = uint8(_chainConfigUint(selection, ".torontocoin.reserves.cadm.tokenDecimals"));
        uint256 cadmStaleAfter = _chainConfigUint(selection, ".torontocoin.reserves.cadm.staleAfter");
        int256 staticCadPrice = int256(_chainConfigUint(selection, ".torontocoin.reserves.cadm.staticCadPrice18"));

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

        uint16 maxVoluntaryFeeBps = uint16(_chainConfigUint(selection, ".torontocoin.preferences.maxVoluntaryFeeBps"));
        uint64 defaultVotingWindow = uint64(_chainConfigUint(selection, ".torontocoin.governance.defaultVotingWindow"));

        uint256 cadPeg18 = _chainConfigUint(selection, ".torontocoin.treasuryController.cadPeg18");
        uint256 userRedeemRateBps = _chainConfigUint(selection, ".torontocoin.treasuryController.userRedeemRateBps");
        uint256 merchantRedeemRateBps =
            _chainConfigUint(selection, ".torontocoin.treasuryController.merchantRedeemRateBps");
        uint256 charityMintRateBps = _chainConfigUint(selection, ".torontocoin.treasuryController.charityMintRateBps");
        uint256 overcollateralizationTarget18 =
            _chainConfigUint(selection, ".torontocoin.treasuryController.overcollateralizationTarget18");

        uint256 charityTopupBps = _chainConfigUint(selection, ".torontocoin.router.charityTopupBps");
        uint256 weightLowMrTcoinLiquidity = _chainConfigUint(selection, ".torontocoin.router.weightLowMrTcoinLiquidity");
        uint256 weightHighCplTcoinLiquidity =
            _chainConfigUint(selection, ".torontocoin.router.weightHighCplTcoinLiquidity");
        uint256 weightUserPoolPreference = _chainConfigUint(selection, ".torontocoin.router.weightUserPoolPreference");
        uint256 weightUserMerchantPreference =
            _chainConfigUint(selection, ".torontocoin.router.weightUserMerchantPreference");

        string memory charityName = _chainConfigString(selection, ".torontocoin.bootstrap.charity.name");
        address charityWallet =
            _chainConfigAddressOrDefault(selection, ".torontocoin.bootstrap.charity.wallet", deployer);
        string memory charityMetadata = _chainConfigString(selection, ".torontocoin.bootstrap.charity.metadataRecordId");
        address stewardAccount =
            _chainConfigAddressOrDefault(selection, ".torontocoin.bootstrap.steward.account", deployer);
        string memory stewardName = _chainConfigString(selection, ".torontocoin.bootstrap.steward.name");
        string memory stewardMetadata = _chainConfigString(selection, ".torontocoin.bootstrap.steward.metadataRecordId");
        bytes32 bootstrapPoolId = _chainConfigBytes32(selection, ".torontocoin.bootstrap.pool.poolId");
        string memory bootstrapPoolName = _chainConfigString(selection, ".torontocoin.bootstrap.pool.name");
        string memory bootstrapPoolMetadata =
            _chainConfigString(selection, ".torontocoin.bootstrap.pool.metadataRecordId");
        bytes32 bootstrapMerchantId = _chainConfigBytes32(selection, ".torontocoin.bootstrap.merchant.merchantId");
        address bootstrapMerchantWallet =
            _chainConfigAddressOrDefault(selection, ".torontocoin.bootstrap.merchant.wallet", deployer);
        string memory bootstrapMerchantMetadata =
            _chainConfigString(selection, ".torontocoin.bootstrap.merchant.metadataRecordId");
        uint256 bootstrapPoolQuoteBps = _chainConfigUint(selection, ".torontocoin.bootstrap.poolQuoteBps");
        bool bootstrapPoolExecutionEnabled = _chainConfigBool(selection, ".torontocoin.bootstrap.poolExecutionEnabled");
        uint256 bootstrapPoolSeed = _chainConfigUint(selection, ".torontocoin.bootstrap.initialPoolSeed");

        if (bootstrapPoolSeed > MAX_GENERO_VISIBLE_AMOUNT) {
            revert ConfigAmountExceedsGeneroTokenLimit(
                ".torontocoin.bootstrap.initialPoolSeed", bootstrapPoolSeed, MAX_GENERO_VISIBLE_AMOUNT
            );
        }

        address mentoBroker = _chainConfigAddress(selection, ".torontocoin.mento.broker");
        address mentoExchangeProvider = _chainConfigAddress(selection, ".torontocoin.mento.exchangeProvider");
        address mentoRouteTokenIn = _chainConfigAddress(selection, ".torontocoin.mento.routeTokenIn");
        bytes32 mentoExchangeId = _chainConfigBytes32(selection, ".torontocoin.mento.exchangeId");
        address mentoUsdcToken = _chainConfigAddress(selection, ".torontocoin.mento.usdcToken");
        address mentoUsdmToken = _chainConfigAddress(selection, ".torontocoin.mento.usdmToken");
        bytes32 mentoUsdcToUsdmExchangeId = _chainConfigBytes32(selection, ".torontocoin.mento.usdcToUsdmExchangeId");
        bytes32 mentoUsdmToCadmExchangeId = _chainConfigBytes32(selection, ".torontocoin.mento.usdmToCadmExchangeId");

        vm.startBroadcast(privateKey);

        ReserveRegistry reserveRegistryImplementation = new ReserveRegistry();
        ReserveRegistry reserveRegistry = ReserveRegistry(
            address(
                new ERC1967Proxy(
                    address(reserveRegistryImplementation),
                    abi.encodeCall(ReserveRegistry.initialize, (deployer, deployer))
                )
            )
        );

        PoolRegistry poolRegistry = new PoolRegistry(deployer, deployer);
        Treasury treasury = new Treasury(deployer);
        CharityRegistry charityRegistry = new CharityRegistry(deployer, deployer, deployer);

        StewardRegistry stewardRegistryImplementation = new StewardRegistry();
        StewardRegistry stewardRegistry = StewardRegistry(
            address(
                new ERC1967Proxy(
                    address(stewardRegistryImplementation),
                    abi.encodeCall(StewardRegistry.initialize, (deployer, deployer, address(charityRegistry)))
                )
            )
        );
        charityRegistry.setStewardRegistry(address(stewardRegistry));

        UserCharityPreferencesRegistry charityPreferences =
            new UserCharityPreferencesRegistry(tokenAdmin, address(charityRegistry), maxVoluntaryFeeBps);
        UserAcceptancePreferencesRegistry acceptancePreferences = new UserAcceptancePreferencesRegistry(tokenAdmin);
        OracleRouter oracleRouter = new OracleRouter(deployer, deployer, address(reserveRegistry));
        StaticCadOracle staticCadOracle = new StaticCadOracle(18, staticCadPrice);

        address sinkAddress = address(treasury);
        GeneroTokenV3 mrTcoin = new GeneroTokenV3(
            mrName,
            mrSymbol,
            mrDecimals,
            mrDecayLevel,
            mrPeriodMinutes,
            sinkAddress,
            address(poolRegistry),
            address(charityPreferences),
            mrDefaultMerchantFeeBps
        );
        GeneroTokenV3 cplTcoin = new GeneroTokenV3(
            cplName,
            cplSymbol,
            cplDecimals,
            cplDecayLevel,
            cplPeriodMinutes,
            sinkAddress,
            address(poolRegistry),
            address(charityPreferences),
            cplDefaultMerchantFeeBps
        );

        TreasuryController treasuryControllerImplementation = new TreasuryController();
        TreasuryController treasuryController = TreasuryController(
            address(
                new ERC1967Proxy(
                    address(treasuryControllerImplementation),
                    abi.encodeCall(
                        TreasuryController.initialize,
                        (
                            deployer,
                            deployer,
                            operationalIndexer,
                            address(treasury),
                            address(mrTcoin),
                            address(reserveRegistry),
                            address(charityRegistry),
                            address(poolRegistry),
                            address(oracleRouter),
                            cadPeg18,
                            userRedeemRateBps,
                            merchantRedeemRateBps,
                            charityMintRateBps,
                            overcollateralizationTarget18
                        )
                    )
                )
            )
        );

        treasury.setAuthorizedCaller(address(treasuryController), true);
        mrTcoin.addWriter(address(treasuryController));

        ManagedPoolAdapter managedPoolAdapter =
            new ManagedPoolAdapter(deployer, deployer, address(poolRegistry), address(mrTcoin), address(cplTcoin));
        MentoBrokerSwapAdapter mentoAdapter = new MentoBrokerSwapAdapter(deployer, mentoBroker);
        ReserveInputRouter reserveInputRouter =
            new ReserveInputRouter(deployer, deployer, address(treasuryController), address(mentoAdapter), cadmToken);
        LiquidityRouter liquidityRouter = new LiquidityRouter(
            deployer,
            deployer,
            address(treasuryController),
            address(reserveInputRouter),
            address(cplTcoin),
            address(charityPreferences),
            address(acceptancePreferences),
            address(poolRegistry),
            address(managedPoolAdapter)
        );

        reserveInputRouter.setLiquidityRouter(address(liquidityRouter));
        treasuryController.setLiquidityRouter(address(liquidityRouter));
        cplTcoin.addWriter(address(liquidityRouter));

        reserveRegistry.addReserveAsset(
            cadmAssetId, cadmToken, cadmCode, cadmTokenDecimals, address(staticCadOracle), address(0), cadmStaleAfter
        );

        charityRegistry.addCharity(charityName, charityWallet, charityMetadata);
        stewardRegistry.registerSteward(stewardAccount, stewardName, stewardMetadata);
        charityRegistry.assignSteward(1, stewardAccount);

        poolRegistry.addPool(bootstrapPoolId, bootstrapPoolName, bootstrapPoolMetadata);
        address[] memory merchantWallets = new address[](1);
        merchantWallets[0] = bootstrapMerchantWallet;
        poolRegistry.approveMerchant(bootstrapMerchantId, bootstrapPoolId, bootstrapMerchantMetadata, merchantWallets);

        managedPoolAdapter.createPoolAccount(bootstrapPoolId);
        managedPoolAdapter.setPoolQuoteBps(bootstrapPoolId, bootstrapPoolQuoteBps);
        managedPoolAdapter.setPoolExecutionEnabled(bootstrapPoolId, bootstrapPoolExecutionEnabled);

        mentoAdapter.setDefaultRoute(mentoRouteTokenIn, mentoExchangeProvider, mentoExchangeId);
        mentoAdapter.setDefaultMultiHopRoute(
            mentoUsdcToken,
            mentoUsdmToken,
            mentoExchangeProvider,
            mentoUsdcToUsdmExchangeId,
            mentoExchangeProvider,
            mentoUsdmToCadmExchangeId
        );
        reserveInputRouter.setInputTokenEnabled(mentoRouteTokenIn, true);
        reserveInputRouter.setInputTokenEnabled(mentoUsdcToken, true);

        liquidityRouter.setCharityTopupBps(charityTopupBps);
        liquidityRouter.setScoringWeights(
            weightLowMrTcoinLiquidity,
            weightHighCplTcoinLiquidity,
            weightUserPoolPreference,
            weightUserMerchantPreference
        );
        liquidityRouter.seedPoolWithCplTcoin(bootstrapPoolId, bootstrapPoolSeed);

        GovernanceExecutionHelper governanceExecutionHelper = new GovernanceExecutionHelper();
        GovernanceProposalHelper governanceProposalHelper = new GovernanceProposalHelper();
        GovernanceRouterProposalHelper governanceRouterProposalHelper = new GovernanceRouterProposalHelper();
        Governance governance = new Governance(
            tokenAdmin,
            address(stewardRegistry),
            address(charityRegistry),
            address(poolRegistry),
            address(reserveRegistry),
            address(treasuryController),
            address(liquidityRouter),
            address(mrTcoin),
            address(governanceExecutionHelper),
            address(governanceProposalHelper),
            address(governanceRouterProposalHelper),
            defaultVotingWindow
        );

        reserveRegistry.setGovernance(address(governance));
        poolRegistry.setGovernance(address(governance));
        stewardRegistry.setGovernance(address(governance));
        charityRegistry.setGovernance(address(governance));
        oracleRouter.setGovernance(address(governance));
        treasuryController.setGovernance(address(governance));
        managedPoolAdapter.setGovernance(address(governance));
        liquidityRouter.setGovernance(address(governance));

        reserveRegistry.transferOwnership(address(governance));
        poolRegistry.transferOwnership(address(governance));
        stewardRegistry.transferOwnership(address(governance));
        charityRegistry.transferOwnership(address(governance));
        oracleRouter.transferOwnership(address(governance));
        treasuryController.transferOwnership(address(governance));
        managedPoolAdapter.transferOwnership(address(governance));
        mentoAdapter.transferOwnership(address(governance));
        reserveInputRouter.transferOwnership(address(governance));
        liquidityRouter.transferOwnership(address(governance));

        if (governanceOwnsTokens) {
            mrTcoin.transferOwnership(address(governance));
            cplTcoin.transferOwnership(address(governance));
        } else {
            mrTcoin.transferOwnership(tokenAdmin);
            cplTcoin.transferOwnership(tokenAdmin);
        }

        if (vaultOwner != deployer) {
            treasury.transferOwnership(vaultOwner);
        }

        vm.stopBroadcast();

        artifacts = DeploymentArtifacts({
            reserveRegistryImplementation: address(reserveRegistryImplementation),
            reserveRegistryProxy: address(reserveRegistry),
            treasuryControllerImplementation: address(treasuryControllerImplementation),
            treasuryControllerProxy: address(treasuryController),
            stewardRegistryImplementation: address(stewardRegistryImplementation),
            stewardRegistryProxy: address(stewardRegistry),
            treasury: address(treasury),
            charityRegistry: address(charityRegistry),
            poolRegistry: address(poolRegistry),
            oracleRouter: address(oracleRouter),
            userCharityPreferencesRegistry: address(charityPreferences),
            userAcceptancePreferencesRegistry: address(acceptancePreferences),
            mrTcoin: address(mrTcoin),
            cplTcoin: address(cplTcoin),
            staticCadOracle: address(staticCadOracle),
            managedPoolAdapter: address(managedPoolAdapter),
            mentoBrokerSwapAdapter: address(mentoAdapter),
            reserveInputRouter: address(reserveInputRouter),
            liquidityRouter: address(liquidityRouter),
            governance: address(governance),
            governanceExecutionHelper: address(governanceExecutionHelper),
            governanceProposalHelper: address(governanceProposalHelper),
            governanceRouterProposalHelper: address(governanceRouterProposalHelper)
        });

        _writeSuiteArtifact(selection, artifacts, vaultOwner, tokenAdmin, operationalIndexer, governanceOwnsTokens);
        _writeWiringArtifact(
            selection, artifacts, bootstrapPoolId, bootstrapMerchantId, cadmAssetId, charityWallet, stewardAccount
        );

        console2.log("TorontoCoin suite deployed for", selection.target);
        console2.log("Governance", artifacts.governance);
        console2.log("TreasuryController", artifacts.treasuryControllerProxy);
        console2.log("LiquidityRouter", artifacts.liquidityRouter);
    }

    function _writeSuiteArtifact(
        ChainSelection memory selection,
        DeploymentArtifacts memory artifacts,
        address vaultOwner,
        address tokenAdmin,
        address operationalIndexer,
        bool governanceOwnsTokens
    ) internal {
        string memory deploymentDir = string.concat("deployments/torontocoin/", selection.target);
        vm.createDir(deploymentDir, true);

        string memory root = "suite";
        vm.serializeString(root, "target", selection.target);
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeUint(root, "deployedAt", block.timestamp);
        vm.serializeAddress(root, "vaultOwner", vaultOwner);
        vm.serializeAddress(root, "tokenAdmin", tokenAdmin);
        vm.serializeAddress(root, "operationalIndexer", operationalIndexer);
        vm.serializeBool(root, "governanceOwnsTokens", governanceOwnsTokens);
        vm.serializeAddress(root, "reserveRegistryImplementation", artifacts.reserveRegistryImplementation);
        vm.serializeAddress(root, "reserveRegistry", artifacts.reserveRegistryProxy);
        vm.serializeAddress(root, "stewardRegistryImplementation", artifacts.stewardRegistryImplementation);
        vm.serializeAddress(root, "stewardRegistry", artifacts.stewardRegistryProxy);
        vm.serializeAddress(root, "treasuryControllerImplementation", artifacts.treasuryControllerImplementation);
        vm.serializeAddress(root, "treasuryController", artifacts.treasuryControllerProxy);
        vm.serializeAddress(root, "treasury", artifacts.treasury);
        vm.serializeAddress(root, "charityRegistry", artifacts.charityRegistry);
        vm.serializeAddress(root, "poolRegistry", artifacts.poolRegistry);
        vm.serializeAddress(root, "oracleRouter", artifacts.oracleRouter);
        vm.serializeAddress(root, "userCharityPreferencesRegistry", artifacts.userCharityPreferencesRegistry);
        vm.serializeAddress(root, "userAcceptancePreferencesRegistry", artifacts.userAcceptancePreferencesRegistry);
        vm.serializeAddress(root, "mrTcoin", artifacts.mrTcoin);
        vm.serializeAddress(root, "cplTcoin", artifacts.cplTcoin);
        vm.serializeAddress(root, "staticCadOracle", artifacts.staticCadOracle);
        vm.serializeAddress(root, "managedPoolAdapter", artifacts.managedPoolAdapter);
        vm.serializeAddress(root, "mentoBrokerSwapAdapter", artifacts.mentoBrokerSwapAdapter);
        vm.serializeAddress(root, "reserveInputRouter", artifacts.reserveInputRouter);
        vm.serializeAddress(root, "liquidityRouter", artifacts.liquidityRouter);
        vm.serializeAddress(root, "governance", artifacts.governance);
        vm.serializeAddress(root, "governanceExecutionHelper", artifacts.governanceExecutionHelper);
        vm.serializeAddress(root, "governanceProposalHelper", artifacts.governanceProposalHelper);
        string memory json =
            vm.serializeAddress(root, "governanceRouterProposalHelper", artifacts.governanceRouterProposalHelper);

        vm.writeJson(json, string.concat(deploymentDir, "/suite.json"));
    }

    function _writeWiringArtifact(
        ChainSelection memory selection,
        DeploymentArtifacts memory artifacts,
        bytes32 bootstrapPoolId,
        bytes32 bootstrapMerchantId,
        bytes32 cadmAssetId,
        address charityWallet,
        address stewardAccount
    ) internal {
        string memory deploymentDir = string.concat("deployments/torontocoin/", selection.target);
        string memory root = "wiring";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "governanceOwner", artifacts.governance);
        vm.serializeAddress(root, "treasuryAuthorizedCaller", artifacts.treasuryControllerProxy);
        vm.serializeAddress(root, "routerWriter", artifacts.liquidityRouter);
        vm.serializeAddress(root, "treasuryWriter", artifacts.treasuryControllerProxy);
        vm.serializeBytes32(root, "reserveAssetId", cadmAssetId);
        vm.serializeBytes32(root, "bootstrapPoolId", bootstrapPoolId);
        vm.serializeBytes32(root, "bootstrapMerchantId", bootstrapMerchantId);
        vm.serializeAddress(root, "bootstrapCharityWallet", charityWallet);
        string memory json = vm.serializeAddress(root, "bootstrapSteward", stewardAccount);
        vm.writeJson(json, string.concat(deploymentDir, "/wiring.json"));
    }
}
