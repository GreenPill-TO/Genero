// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILiquidityRouterGovernance {
    function setGovernance(address governance_) external;
    function setTreasuryController(address treasury_) external;
    function setCplTcoin(address cplTcoin_) external;
    function setCharityPreferencesRegistry(address registry_) external;
    function setPoolRegistry(address registry_) external;
    function setPoolAdapter(address adapter_) external;
    function setCharityTopupBps(uint256 newBps) external;
    function setScoringWeights(
        uint256 newWeightLowMrTcoinLiquidity,
        uint256 newWeightHighCplTcoinLiquidity,
        uint256 newWeightUserPoolPreference,
        uint256 newWeightUserMerchantPreference
    ) external;
}
