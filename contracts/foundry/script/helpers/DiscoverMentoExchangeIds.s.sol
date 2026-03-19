// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "./DeployChainConfig.sol";

interface IMentoBrokerDiscovery {
    function getExchangeProviders() external view returns (address[] memory providers);
}

interface IMentoExchangeProviderDiscovery {
    struct Exchange {
        bytes32 exchangeId;
        address[] assets;
    }

    function getExchanges() external view returns (Exchange[] memory exchanges);
}

contract DiscoverMentoExchangeIds is DeployChainConfig {
    error InvalidConfigAddress(string name);

    function run() external view {
        ChainSelection memory selection = _assertDeployTargetChain();

        address broker = _chainConfigAddress(selection, ".torontocoin.mento.broker");
        address cadmToken = _chainConfigAddress(selection, ".torontocoin.mento.cadmToken");
        address tokenIn = _chainConfigAddress(selection, ".torontocoin.mento.routeTokenIn");
        address providerFilter = _chainConfigAddress(selection, ".torontocoin.mento.exchangeProvider");

        if (broker == address(0)) revert InvalidConfigAddress("torontocoin.mento.broker");
        if (cadmToken == address(0)) revert InvalidConfigAddress("torontocoin.mento.cadmToken");
        if (tokenIn == address(0)) revert InvalidConfigAddress("torontocoin.mento.routeTokenIn");

        console2.log("Deploy target chain", selection.target);
        console2.log("Broker", broker);
        console2.log("Token in", tokenIn);
        console2.log("mCAD", cadmToken);
        if (providerFilter != address(0)) {
            console2.log("Provider filter", providerFilter);
        }

        address[] memory providers = IMentoBrokerDiscovery(broker).getExchangeProviders();
        console2.log("Providers discovered", providers.length);

        for (uint256 i = 0; i < providers.length; i++) {
            address provider = providers[i];
            if (providerFilter != address(0) && provider != providerFilter) {
                continue;
            }

            IMentoExchangeProviderDiscovery.Exchange[] memory exchanges =
                IMentoExchangeProviderDiscovery(provider).getExchanges();

            console2.log("Provider", provider);
            console2.log("Exchange count", exchanges.length);

            for (uint256 j = 0; j < exchanges.length; j++) {
                IMentoExchangeProviderDiscovery.Exchange memory exchange = exchanges[j];
                if (exchange.assets.length < 2) {
                    continue;
                }

                bool matchesTokenPair =
                    _containsAsset(exchange.assets, tokenIn) && _containsAsset(exchange.assets, cadmToken);
                if (!matchesTokenPair) {
                    continue;
                }

                console2.log("Matching exchangeId");
                console2.logBytes32(exchange.exchangeId);
                console2.log("asset[0]", exchange.assets[0]);
                console2.log("asset[1]", exchange.assets[1]);
            }
        }
    }

    function _containsAsset(address[] memory assets, address asset) internal pure returns (bool) {
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == asset) {
                return true;
            }
        }
        return false;
    }
}
