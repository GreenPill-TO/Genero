// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryController {
    function cadPeg18() external view returns (uint256);
    function setTreasury(address treasury_) external;
    function setGovernance(address governance_) external;
    function setIndexer(address indexer_) external;
    function setLiquidityRouter(address liquidityRouter_) external;
    function setTcoinToken(address tcoinToken_) external;
    function setReserveRegistry(address reserveRegistry_) external;
    function setCharityRegistry(address charityRegistry_) external;
    function setPoolRegistry(address poolRegistry_) external;
    function setOracleRouter(address oracleRouter_) external;
    function setCadPeg(uint256 newCadPeg18) external;
    function setUserRedeemRate(uint256 newRateBps) external;
    function setMerchantRedeemRate(uint256 newRateBps) external;
    function setCharityMintRate(uint256 newRateBps) external;
    function setOvercollateralizationTarget(uint256 newTarget18) external;
    function setAdminCanMintToCharity(bool enabled) external;
    function pauseMinting() external;
    function unpauseMinting() external;
    function pauseRedemption() external;
    function unpauseRedemption() external;
    function pauseAssetForTreasury(bytes32 assetId) external;
    function unpauseAssetForTreasury(bytes32 assetId) external;
    function mintToCharity(uint256 amount) external;
    function mintToCharity(uint256 charityId, uint256 amount) external;
}
