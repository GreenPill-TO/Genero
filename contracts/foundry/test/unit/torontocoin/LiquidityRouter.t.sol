// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {
    LiquidityRouter,
    ITreasuryControllerForLiquidityRouter,
    ICplTcoinForLiquidityRouter,
    IUserCharityPreferencesRegistryForLiquidityRouter,
    IPoolRegistryForLiquidityRouter,
    IPoolAdapter
} from "../../../src/torontocoin/LiquidityRouter.sol";
import {ReserveInputRouter} from "../../../src/torontocoin/ReserveInputRouter.sol";
import {UserAcceptancePreferencesRegistry} from "../../../src/torontocoin/UserAcceptancePreferencesRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapAdapter} from "./mocks/MockSwapAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockCplTcoinForRouter is ICplTcoinForLiquidityRouter {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount, bytes calldata data) external {
        data;
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "INSUFFICIENT");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockTreasuryVaultForRouter {
    using SafeERC20 for IERC20;

    function depositReserveFrom(address from, address token, uint256 amount) external returns (bool) {
        IERC20(token).safeTransferFrom(from, address(this), amount);
        return true;
    }

    function reserveBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}

contract MockTreasuryControllerForRouter is ITreasuryControllerForLiquidityRouter {
    mapping(bytes32 => address) public reserveAssetTokenById;
    mapping(address => bytes32) public reserveAssetIdByToken;
    mapping(bytes32 => uint256) public mintBpsByAsset;

    address public override treasury;
    address public override tcoinToken;

    constructor(address treasury_, address tcoinToken_) {
        treasury = treasury_;
        tcoinToken = tcoinToken_;
    }

    function setReserveAsset(bytes32 assetId, address token, uint256 mintBps) external {
        reserveAssetTokenById[assetId] = token;
        reserveAssetIdByToken[token] = assetId;
        mintBpsByAsset[assetId] = mintBps;
    }

    function depositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount, address payer)
        external
        returns (uint256 mrTcoinOut)
    {
        address token = reserveAssetTokenById[assetId];
        MockTreasuryVaultForRouter(treasury).depositReserveFrom(payer, token, assetAmount);
        mrTcoinOut = (assetAmount * mintBpsByAsset[assetId]) / 10_000;
        MockERC20(tcoinToken).mint(msg.sender, mrTcoinOut);
    }

    function previewDepositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, uint256 cadValue18, bool usedFallbackOracle)
    {
        mrTcoinOut = (assetAmount * mintBpsByAsset[assetId]) / 10_000;
        cadValue18 = mrTcoinOut;
        usedFallbackOracle = false;
    }

    function getReserveAssetToken(bytes32 assetId) external view returns (address token) {
        token = reserveAssetTokenById[assetId];
    }

    function resolveAcceptedReserveAsset(address token)
        external
        view
        returns (bool accepted, bytes32 assetId, address reserveToken)
    {
        assetId = reserveAssetIdByToken[token];
        if (assetId == bytes32(0)) {
            return (false, bytes32(0), address(0));
        }
        return (true, assetId, reserveAssetTokenById[assetId]);
    }
}

    contract MockCharityPreferencesForRouter is IUserCharityPreferencesRegistryForLiquidityRouter {
        uint256 public charityId;
        address public charityWallet;

        function setResolvedCharity(uint256 resolvedCharityId, address resolvedCharityWallet) external {
            charityId = resolvedCharityId;
            charityWallet = resolvedCharityWallet;
        }

        function resolveFeePreferences(address)
            external
            view
            returns (uint256 resolvedCharityId, address resolvedCharityWallet, uint16 voluntaryFeeBps)
        {
            return (charityId, charityWallet, voluntaryFeeBps);
        }
    }

    contract MockPoolRegistryForRouter is IPoolRegistryForLiquidityRouter {
        bytes32[] internal poolIds;
        mapping(bytes32 => bool) internal active;

        function setPools(bytes32[] calldata ids) external {
            delete poolIds;
            for (uint256 i = 0; i < ids.length; ++i) {
                poolIds.push(ids[i]);
            }
        }

        function setPoolActive(bytes32 poolId, bool isActive) external {
            active[poolId] = isActive;
        }

        function listPoolIds() external view returns (bytes32[] memory) {
            return poolIds;
        }

        function isPoolActive(bytes32 poolId) external view returns (bool) {
            return active[poolId];
        }
    }

    contract MockPoolAdapterForRouter is IPoolAdapter {
        struct PoolState {
            address poolAccount;
            uint256 mrLiquidity;
            uint256 cplLiquidity;
            bool active;
            uint256 quoteBps;
            bytes32 merchantId;
        }

        mapping(bytes32 => PoolState) internal pools;
        MockCplTcoinForRouter internal cplToken;
        MockERC20 internal mrTcoin;

        constructor(address cplToken_, address mrTcoin_) {
            cplToken = MockCplTcoinForRouter(cplToken_);
            mrTcoin = MockERC20(mrTcoin_);
        }

        function setPool(
            bytes32 poolId,
            address poolAccount,
            uint256 mrLiquidity,
            uint256 cplLiquidity,
            bool active,
            uint256 quoteBps,
            bytes32 merchantId
        ) external {
            pools[poolId] = PoolState({
                poolAccount: poolAccount,
                mrLiquidity: mrLiquidity,
                cplLiquidity: cplLiquidity,
                active: active,
                quoteBps: quoteBps,
                merchantId: merchantId
            });
        }

        function getPoolLiquidityState(bytes32 poolId)
            external
            view
            returns (uint256 mrTcoinLiquidity, uint256 cplTcoinLiquidity, bool active)
        {
            PoolState memory pool = pools[poolId];
            return (pool.mrLiquidity, pool.cplLiquidity, pool.active);
        }

        function previewBuyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn)
            external
            view
            returns (uint256 cplTcoinOut)
        {
            PoolState memory pool = pools[poolId];
            cplTcoinOut = (mrTcoinAmountIn * pool.quoteBps) / 10_000;
        }

        function buyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn, uint256 minCplTcoinOut, address recipient)
            external
            returns (uint256 cplTcoinOut)
        {
            PoolState storage pool = pools[poolId];
            cplTcoinOut = (mrTcoinAmountIn * pool.quoteBps) / 10_000;
            require(pool.active, "INACTIVE");
            require(cplTcoinOut >= minCplTcoinOut, "MIN_OUT");
            require(pool.cplLiquidity >= cplTcoinOut, "LOW_LIQ");

            mrTcoin.transferFrom(msg.sender, pool.poolAccount, mrTcoinAmountIn);
            pool.mrLiquidity += mrTcoinAmountIn;
            pool.cplLiquidity -= cplTcoinOut;
            cplToken.mint(recipient, cplTcoinOut, "");
        }

        function poolMatchesAnyMerchantIds(bytes32 poolId, bytes32[] memory merchantIds)
            external
            view
            returns (bool matches)
        {
            PoolState memory pool = pools[poolId];
            for (uint256 i = 0; i < merchantIds.length; ++i) {
                if (merchantIds[i] == pool.merchantId) {
                    return true;
                }
            }
        }

        function getPoolAccount(bytes32 poolId) external view returns (address poolAccount) {
            return pools[poolId].poolAccount;
        }
    }

    contract LiquidityRouterTest is Test {
        struct BuyResult {
            bytes32 selectedPoolId;
            bytes32 reserveAssetId;
            uint256 reserveAmountUsed;
            uint256 mrUsed;
            uint256 cplOut;
            uint256 charityTopupOut;
            uint256 resolvedCharityId;
        }

        struct PreviewResult {
            bytes32 selectedPoolId;
            bytes32 reserveAssetId;
            uint256 reserveAmountOut;
            uint256 mrOut;
            uint256 cplOut;
            uint256 charityTopupOut;
            uint256 resolvedCharityId;
            address charityWallet;
        }

        bytes32 private constant RESERVE_ASSET_ID = bytes32("USDC");
        bytes32 private constant MCAD_ASSET_ID = bytes32("MCAD");
        bytes32 private constant POOL_A = bytes32("pool-a");
        bytes32 private constant POOL_B = bytes32("pool-b");
        bytes32 private constant MERCHANT_A = bytes32("merchant-a");
        bytes32 private constant MERCHANT_B = bytes32("merchant-b");

        address private constant USER = address(0x1001);
        address private constant CHARITY = address(0x2001);
        address private constant POOL_A_ACCOUNT = address(0x3001);
        address private constant POOL_B_ACCOUNT = address(0x3002);

        MockERC20 private reserveToken;
        MockERC20 private daiToken;
        MockERC20 private cadmToken;
        MockERC20 private mrTcoin;
        MockCplTcoinForRouter private cplToken;
        MockTreasuryVaultForRouter private treasuryVault;
        MockTreasuryControllerForRouter private treasury;
        MockCharityPreferencesForRouter private charityPreferences;
        UserAcceptancePreferencesRegistry private acceptanceRegistry;
        MockPoolRegistryForRouter private poolRegistry;
        MockPoolAdapterForRouter private poolAdapter;
        MockSwapAdapter private swapAdapter;
        ReserveInputRouter private reserveInputRouter;
        LiquidityRouter private router;

        function setUp() public {
            reserveToken = new MockERC20("USD Coin", "USDC", 6);
            daiToken = new MockERC20("Dai Stablecoin", "DAI", 18);
            cadmToken = new MockERC20("Mento CAD", "mCAD", 18);
            mrTcoin = new MockERC20("mrTCOIN", "MRT", 6);
            cplToken = new MockCplTcoinForRouter();
            treasuryVault = new MockTreasuryVaultForRouter();
            treasury = new MockTreasuryControllerForRouter(address(treasuryVault), address(mrTcoin));
            charityPreferences = new MockCharityPreferencesForRouter();
            acceptanceRegistry = new UserAcceptancePreferencesRegistry(address(this));
            poolRegistry = new MockPoolRegistryForRouter();
            poolAdapter = new MockPoolAdapterForRouter(address(cplToken), address(mrTcoin));
            swapAdapter = new MockSwapAdapter();
            reserveInputRouter = new ReserveInputRouter(
                address(this), address(this), address(treasury), address(swapAdapter), address(cadmToken)
            );

            router = new LiquidityRouter(
                address(this),
                address(this),
                address(treasury),
                address(reserveInputRouter),
                address(cplToken),
                address(charityPreferences),
                address(acceptanceRegistry),
                address(poolRegistry),
                address(poolAdapter)
            );
            reserveInputRouter.setLiquidityRouter(address(router));
            reserveInputRouter.setInputTokenEnabled(address(daiToken), true);

            treasury.setReserveAsset(RESERVE_ASSET_ID, address(reserveToken), 10_000);
            treasury.setReserveAsset(MCAD_ASSET_ID, address(cadmToken), 10_000);
            charityPreferences.setResolvedCharity(1, CHARITY);

            bytes32[] memory poolIds = new bytes32[](2);
            poolIds[0] = POOL_A;
            poolIds[1] = POOL_B;
            poolRegistry.setPools(poolIds);
            poolRegistry.setPoolActive(POOL_A, true);
            poolRegistry.setPoolActive(POOL_B, true);

            poolAdapter.setPool(POOL_A, POOL_A_ACCOUNT, 10, 1_000e6, true, 10_000, MERCHANT_A);
            poolAdapter.setPool(POOL_B, POOL_B_ACCOUNT, 10, 1_000e6, true, 10_000, MERCHANT_B);

            reserveToken.mint(USER, 1_000e6);
            daiToken.mint(USER, 1_000e18);
            vm.prank(USER);
            reserveToken.approve(address(router), type(uint256).max);
            vm.prank(USER);
            daiToken.approve(address(router), type(uint256).max);
        }

        function test_BuyCplTcoinUsesStoredAcceptedPoolPreferenceAndMintsCharityTopup() public {
            vm.prank(USER);
            acceptanceRegistry.setPoolAcceptance(POOL_B, UserAcceptancePreferencesRegistry.AcceptanceStatus.Accepted);

            PreviewResult memory preview = _preview(USER, address(reserveToken), 100e6);

            assertEq(preview.selectedPoolId, POOL_B);
            assertEq(preview.reserveAssetId, RESERVE_ASSET_ID);
            assertEq(preview.reserveAmountOut, 100e6);
            assertEq(preview.mrOut, 100e6);
            assertEq(preview.cplOut, 100e6);
            assertEq(preview.charityTopupOut, 3e6);
            assertEq(preview.resolvedCharityId, 1);
            assertEq(preview.charityWallet, CHARITY);

            vm.prank(USER);
            BuyResult memory purchase = _buy(address(reserveToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_B);
            assertEq(purchase.reserveAssetId, RESERVE_ASSET_ID);
            assertEq(purchase.reserveAmountUsed, 100e6);
            assertEq(purchase.mrUsed, 100e6);
            assertEq(purchase.cplOut, 100e6);
            assertEq(purchase.charityTopupOut, 3e6);
            assertEq(cplToken.balanceOf(USER), 100e6);
            assertEq(cplToken.balanceOf(CHARITY), 3e6);
            assertEq(reserveToken.balanceOf(address(router)), 0);
            assertEq(reserveToken.balanceOf(address(treasuryVault)), 100e6);
            assertEq(mrTcoin.balanceOf(address(router)), 0);
            assertEq(mrTcoin.balanceOf(POOL_B_ACCOUNT), 100e6);
        }

        function test_DeniedPoolHardExcludesThatPool() public {
            vm.prank(USER);
            acceptanceRegistry.setPoolAcceptance(POOL_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Denied);

            vm.prank(USER);
            BuyResult memory purchase = _buy(address(reserveToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_B);
            assertEq(mrTcoin.balanceOf(POOL_B_ACCOUNT), 100e6);
        }

        function test_DeniedMerchantHardExcludesMatchingPool() public {
            vm.prank(USER);
            acceptanceRegistry.setMerchantAcceptance(
                MERCHANT_B, UserAcceptancePreferencesRegistry.AcceptanceStatus.Denied
            );

            vm.prank(USER);
            BuyResult memory purchase = _buy(address(reserveToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_A);
        }

        function test_BuyCplTcoinNormalizesUnsupportedInputThroughReserveInputRouter() public {
            vm.prank(USER);
            BuyResult memory purchase = _buy(address(daiToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_A);
            assertEq(purchase.reserveAssetId, MCAD_ASSET_ID);
            assertEq(purchase.reserveAmountUsed, 100e6);
            assertEq(cadmToken.balanceOf(address(treasuryVault)), 100e6);
            assertEq(daiToken.balanceOf(address(router)), 0);
            assertEq(daiToken.balanceOf(address(reserveInputRouter)), 0);
        }

        function test_StrictModeRequiresAcceptedCplTcoin() public {
            vm.prank(USER);
            acceptanceRegistry.setStrictAcceptedOnly(true);

            vm.prank(USER);
            vm.expectRevert(LiquidityRouter.NoEligiblePool.selector);
            _buy(address(reserveToken), 100e6, 100e6, 100e6);
        }

        function test_StrictModeAllowsEligibilityViaAcceptedMerchantWithoutRanking() public {
            vm.startPrank(USER);
            acceptanceRegistry.setStrictAcceptedOnly(true);
            acceptanceRegistry.setTokenAcceptance(
                address(cplToken), UserAcceptancePreferencesRegistry.AcceptanceStatus.Accepted
            );
            acceptanceRegistry.setMerchantAcceptance(
                MERCHANT_B, UserAcceptancePreferencesRegistry.AcceptanceStatus.Accepted
            );
            vm.stopPrank();

            vm.prank(USER);
            BuyResult memory purchase = _buy(address(reserveToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_B);
        }

        function test_PreferredMerchantOrderChangesScoringDeterministically() public {
            bytes32[] memory preferred = new bytes32[](2);
            preferred[0] = MERCHANT_B;
            preferred[1] = MERCHANT_A;

            vm.prank(USER);
            acceptanceRegistry.replacePreferredMerchants(preferred);

            vm.prank(USER);
            BuyResult memory purchase = _buy(address(reserveToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_B);

            preferred[0] = MERCHANT_A;
            preferred[1] = MERCHANT_B;

            vm.prank(USER);
            acceptanceRegistry.replacePreferredMerchants(preferred);

            PreviewResult memory preview = _preview(USER, address(reserveToken), 100e6);
            assertEq(preview.selectedPoolId, POOL_A);
        }

        function test_DenyingCplTcoinMakesAllRoutesIneligible() public {
            vm.prank(USER);
            acceptanceRegistry.setTokenAcceptance(
                address(cplToken), UserAcceptancePreferencesRegistry.AcceptanceStatus.Denied
            );

            vm.prank(USER);
            vm.expectRevert(LiquidityRouter.NoEligiblePool.selector);
            _buy(address(reserveToken), 100e6, 100e6, 100e6);
        }

        function test_SeedAndTopUpMintOnlyToResolvedPoolAccount() public {
            router.seedPoolWithCplTcoin(POOL_A, 25e6);
            router.topUpPoolWithCplTcoin(POOL_A, 5e6);

            assertEq(cplToken.balanceOf(POOL_A_ACCOUNT), 30e6);
            assertEq(cplToken.balanceOf(address(router)), 0);
        }

        function _buy(address inputToken, uint256 inputAmount, uint256 minReserveOut, uint256 minCplTcoinOut)
            internal
            returns (BuyResult memory result)
        {
            (
                result.selectedPoolId,
                result.reserveAssetId,
                result.reserveAmountUsed,
                result.mrUsed,
                result.cplOut,
                result.charityTopupOut,
                result.resolvedCharityId
            ) = router.buyCplTcoin(inputToken, inputAmount, minReserveOut, minCplTcoinOut);
        }

        function _preview(address buyer, address inputToken, uint256 inputAmount)
            internal
            view
            returns (PreviewResult memory result)
        {
            (
                result.selectedPoolId,
                result.reserveAssetId,
                result.reserveAmountOut,
                result.mrOut,
                result.cplOut,
                result.charityTopupOut,
                result.resolvedCharityId,
                result.charityWallet
            ) = router.previewBuyCplTcoin(buyer, inputToken, inputAmount);
        }
    }
