// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../../src/torontocoin/LiquidityRouter.sol";
import "../../src/torontocoin/ReserveInputRouter.sol";
import "../../src/torontocoin/MentoBrokerSwapAdapter.sol";
import "../../src/torontocoin/interfaces/ITreasuryController.sol";
import "../helpers/DeployChainConfig.sol";

contract DeployLiquidityRoutingStack is DeployChainConfig {
    error MissingConfigAddress(string key);

    function run()
        external
        returns (address liquidityRouterAddress, address reserveInputRouterAddress, address mentoSwapAdapterAddress)
    {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        ChainSelection memory selection = _assertDeployTargetChain();

        address governance = _requiredConfigAddress(selection, ".torontocoin.governance", "torontocoin.governance");
        address treasuryController =
            _requiredConfigAddress(selection, ".torontocoin.treasuryController", "torontocoin.treasuryController");
        address cplTcoin = _requiredConfigAddress(selection, ".torontocoin.cplTcoin", "torontocoin.cplTcoin");
        address charityPreferencesRegistry = _requiredConfigAddress(
            selection, ".torontocoin.charityPreferencesRegistry", "torontocoin.charityPreferencesRegistry"
        );
        address acceptancePreferencesRegistry = _requiredConfigAddress(
            selection, ".torontocoin.acceptancePreferencesRegistry", "torontocoin.acceptancePreferencesRegistry"
        );
        address poolRegistry =
            _requiredConfigAddress(selection, ".torontocoin.poolRegistry", "torontocoin.poolRegistry");
        address poolAdapter = _requiredConfigAddress(selection, ".torontocoin.poolAdapter", "torontocoin.poolAdapter");
        address cadmToken =
            _requiredConfigAddress(selection, ".torontocoin.mento.cadmToken", "torontocoin.mento.cadmToken");
        address mentoBroker = _requiredConfigAddress(selection, ".torontocoin.mento.broker", "torontocoin.mento.broker");

        address mentoRouteTokenIn = _chainConfigAddress(selection, ".torontocoin.mento.routeTokenIn");
        address mentoExchangeProvider = _chainConfigAddress(selection, ".torontocoin.mento.exchangeProvider");
        bytes32 mentoExchangeId = _chainConfigBytes32(selection, ".torontocoin.mento.exchangeId");

        vm.startBroadcast(privateKey);

        MentoBrokerSwapAdapter mentoAdapter = new MentoBrokerSwapAdapter(deployer, mentoBroker);
        ReserveInputRouter reserveInputRouter =
            new ReserveInputRouter(deployer, deployer, treasuryController, address(mentoAdapter), cadmToken);
        LiquidityRouter liquidityRouter = new LiquidityRouter(
            deployer,
            governance,
            treasuryController,
            address(reserveInputRouter),
            cplTcoin,
            charityPreferencesRegistry,
            acceptancePreferencesRegistry,
            poolRegistry,
            poolAdapter
        );

        reserveInputRouter.setLiquidityRouter(address(liquidityRouter));
        ITreasuryController(treasuryController).setLiquidityRouter(address(liquidityRouter));

        if (mentoRouteTokenIn != address(0)) {
            require(mentoExchangeProvider != address(0), "mento.exchangeProvider required");
            require(mentoExchangeId != bytes32(0), "mento.exchangeId required");
            mentoAdapter.setDefaultRoute(mentoRouteTokenIn, mentoExchangeProvider, mentoExchangeId);
            reserveInputRouter.setInputTokenEnabled(mentoRouteTokenIn, true);
        }

        reserveInputRouter.transferOwnership(governance);
        liquidityRouter.transferOwnership(governance);
        mentoAdapter.transferOwnership(governance);

        vm.stopBroadcast();

        liquidityRouterAddress = address(liquidityRouter);
        reserveInputRouterAddress = address(reserveInputRouter);
        mentoSwapAdapterAddress = address(mentoAdapter);

        _writeArtifact(
            governance,
            treasuryController,
            cplTcoin,
            charityPreferencesRegistry,
            acceptancePreferencesRegistry,
            poolRegistry,
            poolAdapter,
            cadmToken,
            mentoBroker,
            mentoRouteTokenIn,
            mentoExchangeProvider,
            mentoExchangeId,
            liquidityRouterAddress,
            reserveInputRouterAddress,
            mentoSwapAdapterAddress
        );

        console2.log("LiquidityRouter deployed at", liquidityRouterAddress);
        console2.log("ReserveInputRouter deployed at", reserveInputRouterAddress);
        console2.log("MentoBrokerSwapAdapter deployed at", mentoSwapAdapterAddress);
        console2.log("Ownership transferred to governance", governance);
        console2.log("Deploy target chain", selection.target);
        console2.log("Expected RPC env", selection.rpcEnvVar);
        console2.log("Explorer API env", selection.explorerApiKeyEnvVar);
    }

    function _writeArtifact(
        address governance,
        address treasuryController,
        address cplTcoin,
        address charityPreferencesRegistry,
        address acceptancePreferencesRegistry,
        address poolRegistry,
        address poolAdapter,
        address cadmToken,
        address mentoBroker,
        address mentoRouteTokenIn,
        address mentoExchangeProvider,
        bytes32 mentoExchangeId,
        address liquidityRouterAddress,
        address reserveInputRouterAddress,
        address mentoSwapAdapterAddress
    ) internal {
        string memory deploymentDir = string.concat("deployments/torontocoin/", vm.toString(block.chainid));
        vm.createDir(deploymentDir, true);

        string memory outputPath = string.concat(deploymentDir, "/liquidity-routing-stack.json");
        string memory payload = "{\n";
        payload = string.concat(payload, '  "chainId": ', vm.toString(block.chainid), ",\n");
        payload = string.concat(payload, '  "deployedAt": ', vm.toString(block.timestamp), ",\n");
        payload = string.concat(payload, '  "governance": "', vm.toString(governance), '",\n');
        payload = string.concat(payload, '  "treasuryController": "', vm.toString(treasuryController), '",\n');
        payload = string.concat(payload, '  "cplTcoin": "', vm.toString(cplTcoin), '",\n');
        payload = string.concat(
            payload, '  "charityPreferencesRegistry": "', vm.toString(charityPreferencesRegistry), '",\n'
        );
        payload = string.concat(
            payload, '  "acceptancePreferencesRegistry": "', vm.toString(acceptancePreferencesRegistry), '",\n'
        );
        payload = string.concat(payload, '  "poolRegistry": "', vm.toString(poolRegistry), '",\n');
        payload = string.concat(payload, '  "poolAdapter": "', vm.toString(poolAdapter), '",\n');
        payload = string.concat(payload, '  "cadmToken": "', vm.toString(cadmToken), '",\n');
        payload = string.concat(payload, '  "mentoBroker": "', vm.toString(mentoBroker), '",\n');
        payload = string.concat(payload, '  "mentoSwapAdapter": "', vm.toString(mentoSwapAdapterAddress), '",\n');
        payload = string.concat(payload, '  "reserveInputRouter": "', vm.toString(reserveInputRouterAddress), '",\n');
        payload = string.concat(payload, '  "liquidityRouter": "', vm.toString(liquidityRouterAddress), '",\n');
        payload = string.concat(payload, '  "optionalRouteTokenIn": "', vm.toString(mentoRouteTokenIn), '",\n');
        payload =
            string.concat(payload, '  "optionalRouteExchangeProvider": "', vm.toString(mentoExchangeProvider), '",\n');
        payload = string.concat(payload, '  "optionalRouteExchangeId": "', vm.toString(mentoExchangeId), '"\n');
        payload = string.concat(payload, "}\n");

        vm.writeFile(outputPath, payload);
        console2.log("Deployment artifact", outputPath);
    }

    function _requiredConfigAddress(ChainSelection memory selection, string memory suffix, string memory key)
        internal
        view
        returns (address value)
    {
        value = _chainConfigAddress(selection, suffix);
        if (value == address(0)) revert MissingConfigAddress(key);
    }
}
