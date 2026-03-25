// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {
    LiquidityRouter,
    ITreasuryControllerForLiquidityRouter,
    ICplTcoinForLiquidityRouter,
    IUserCharityPreferencesRegistryForLiquidityRouter
} from "../../../src/torontocoin/LiquidityRouter.sol";
import {PoolRegistry} from "../../../src/torontocoin/PoolRegistry.sol";
import {ReserveInputRouter} from "../../../src/torontocoin/ReserveInputRouter.sol";
import {SarafuSwapPoolAdapter} from "../../../src/torontocoin/SarafuSwapPoolAdapter.sol";
import {UserAcceptancePreferencesRegistry} from "../../../src/torontocoin/UserAcceptancePreferencesRegistry.sol";
import {Limiter} from "../../../src/sarafu-read-only/Limiter.sol";
import {PriceIndexQuoter} from "../../../src/sarafu-read-only/PriceIndexQuoter.sol";
import {SwapPool} from "../../../src/sarafu-read-only/SwapPool.sol";
import {TokenUniqueSymbolIndex} from "../../../src/sarafu-read-only/TokenUniqueSymbolIndex.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapAdapter} from "./mocks/MockSwapAdapter.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockMintableCplTcoin is ERC20, ICplTcoinForLiquidityRouter {
    uint8 private immutable _tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 tokenDecimals_) ERC20(name_, symbol_) {
        _tokenDecimals = tokenDecimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address to, uint256 amount, bytes calldata data) external {
        data;
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override(ERC20, ICplTcoinForLiquidityRouter) returns (bool) {
        return super.transfer(to, amount);
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

        MockERC20 private reserveToken;
        MockERC20 private daiToken;
        MockERC20 private cadmToken;
        MockERC20 private mrTcoin;
        MockMintableCplTcoin private cplToken;
        MockTreasuryVaultForRouter private treasuryVault;
        MockTreasuryControllerForRouter private treasury;
        MockCharityPreferencesForRouter private charityPreferences;
        UserAcceptancePreferencesRegistry private acceptanceRegistry;
        PoolRegistry private poolRegistry;
        TokenUniqueSymbolIndex private tokenRegistry;
        Limiter private limiter;
        PriceIndexQuoter private quoter;
        SwapPool private swapPoolA;
        SwapPool private swapPoolB;
        SarafuSwapPoolAdapter private poolAdapter;
        MockSwapAdapter private swapAdapter;
        ReserveInputRouter private reserveInputRouter;
        LiquidityRouter private router;

        function setUp() public {
            reserveToken = new MockERC20("USD Coin", "USDC", 6);
            daiToken = new MockERC20("Dai Stablecoin", "DAI", 18);
            cadmToken = new MockERC20("Mento CAD", "mCAD", 18);
            mrTcoin = new MockERC20("mrTCOIN", "MRT", 6);
            cplToken = new MockMintableCplTcoin("cplTCOIN", "CPL", 6);
            treasuryVault = new MockTreasuryVaultForRouter();
            treasury = new MockTreasuryControllerForRouter(address(treasuryVault), address(mrTcoin));
            charityPreferences = new MockCharityPreferencesForRouter();
            acceptanceRegistry = new UserAcceptancePreferencesRegistry(address(this));
            poolRegistry = new PoolRegistry(address(this), address(this));
            tokenRegistry = new TokenUniqueSymbolIndex();
            limiter = new Limiter();
            quoter = new PriceIndexQuoter();
            swapPoolA = new SwapPool("Pool A", "PA", 6, address(tokenRegistry), address(limiter));
            swapPoolB = new SwapPool("Pool B", "PB", 6, address(tokenRegistry), address(limiter));
            poolAdapter = new SarafuSwapPoolAdapter(
                address(this), address(this), address(poolRegistry), address(mrTcoin), address(cplToken)
            );
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

            tokenRegistry.addWriter(address(this));
            tokenRegistry.register(address(mrTcoin));
            tokenRegistry.register(address(cplToken));
            swapPoolA.setQuoter(address(quoter));
            swapPoolB.setQuoter(address(quoter));

            poolRegistry.addPool(POOL_A, "Pool A", "pool-a");
            poolRegistry.addPool(POOL_B, "Pool B", "pool-b");
            poolRegistry.setPoolAddress(POOL_A, address(swapPoolA));
            poolRegistry.setPoolAddress(POOL_B, address(swapPoolB));
            poolRegistry.approveMerchant(MERCHANT_A, POOL_A, "merchant-a", new address[](0));
            poolRegistry.approveMerchant(MERCHANT_B, POOL_B, "merchant-b", new address[](0));

            limiter.setLimitFor(address(mrTcoin), address(swapPoolA), 1_000_000e6);
            limiter.setLimitFor(address(cplToken), address(swapPoolA), 1_000_000e6);
            limiter.setLimitFor(address(mrTcoin), address(swapPoolB), 1_000_000e6);
            limiter.setLimitFor(address(cplToken), address(swapPoolB), 1_000_000e6);

            treasury.setReserveAsset(RESERVE_ASSET_ID, address(reserveToken), 10_000);
            treasury.setReserveAsset(MCAD_ASSET_ID, address(cadmToken), 10_000);
            charityPreferences.setResolvedCharity(1, CHARITY);

            router.seedPoolWithCplTcoin(POOL_A, 1_000e6);
            router.seedPoolWithCplTcoin(POOL_B, 1_000e6);

            reserveToken.mint(USER, 1_000e6);
            daiToken.mint(USER, 1_000e18);
            vm.prank(USER);
            reserveToken.approve(address(router), type(uint256).max);
            vm.prank(USER);
            daiToken.approve(address(router), type(uint256).max);
        }

        function test_BuyCplTcoinExecutesAgainstSelectedSarafuPoolAndMintsCharityTopup() public {
            PreviewResult memory preview = _preview(POOL_A, USER, address(reserveToken), 100e6);

            assertEq(preview.selectedPoolId, POOL_A);
            assertEq(preview.reserveAssetId, RESERVE_ASSET_ID);
            assertEq(preview.reserveAmountOut, 100e6);
            assertEq(preview.mrOut, 100e6);
            assertEq(preview.cplOut, 100e6);
            assertEq(preview.charityTopupOut, 3e6);
            assertEq(preview.resolvedCharityId, 1);
            assertEq(preview.charityWallet, CHARITY);

            vm.prank(USER);
            BuyResult memory purchase = _buy(POOL_A, address(reserveToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_A);
            assertEq(purchase.reserveAssetId, RESERVE_ASSET_ID);
            assertEq(purchase.reserveAmountUsed, 100e6);
            assertEq(purchase.mrUsed, 100e6);
            assertEq(purchase.cplOut, 100e6);
            assertEq(purchase.charityTopupOut, 3e6);
            assertEq(cplToken.balanceOf(USER), 100e6);
            assertEq(cplToken.balanceOf(CHARITY), 3e6);
            assertEq(reserveToken.balanceOf(address(router)), 0);
            assertEq(reserveToken.balanceOf(address(treasuryVault)), 100e6);
            assertEq(mrTcoin.balanceOf(address(swapPoolA)), 100e6);
            assertEq(cplToken.balanceOf(address(swapPoolA)), 900e6);
        }

        function test_DeniedPoolHardExcludesSelectedSarafuPool() public {
            vm.prank(USER);
            acceptanceRegistry.setPoolAcceptance(POOL_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Denied);

            vm.prank(USER);
            vm.expectRevert(LiquidityRouter.NoEligiblePool.selector);
            _buy(POOL_A, address(reserveToken), 100e6, 100e6, 100e6);
        }

        function test_DeniedMerchantHardExcludesSelectedSarafuPool() public {
            vm.prank(USER);
            acceptanceRegistry.setMerchantAcceptance(
                MERCHANT_B, UserAcceptancePreferencesRegistry.AcceptanceStatus.Denied
            );

            vm.prank(USER);
            vm.expectRevert(LiquidityRouter.NoEligiblePool.selector);
            _buy(POOL_B, address(reserveToken), 100e6, 100e6, 100e6);
        }

        function test_BuyCplTcoinNormalizesUnsupportedInputBeforeSarafuPoolSwap() public {
            vm.prank(USER);
            BuyResult memory purchase = _buy(POOL_A, address(daiToken), 100e6, 100e6, 100e6);

            assertEq(purchase.selectedPoolId, POOL_A);
            assertEq(purchase.reserveAssetId, MCAD_ASSET_ID);
            assertEq(purchase.reserveAmountUsed, 100e6);
            assertEq(cadmToken.balanceOf(address(treasuryVault)), 100e6);
            assertEq(mrTcoin.balanceOf(address(swapPoolA)), 100e6);
        }

        function test_StrictModeRequiresAcceptedTokenAndAcceptedPoolOrMerchant() public {
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
            vm.expectRevert(LiquidityRouter.NoEligiblePool.selector);
            _buy(POOL_A, address(reserveToken), 100e6, 100e6, 100e6);

            vm.prank(USER);
            BuyResult memory purchase = _buy(POOL_B, address(reserveToken), 100e6, 100e6, 100e6);
            assertEq(purchase.selectedPoolId, POOL_B);
        }

        function test_SeedAndTopUpDepositIntoRealSarafuPool() public {
            router.seedPoolWithCplTcoin(POOL_A, 25e6);
            router.topUpPoolWithCplTcoin(POOL_A, 5e6);

            assertEq(cplToken.balanceOf(address(swapPoolA)), 1_030e6);
            assertEq(cplToken.balanceOf(address(router)), 0);
        }

        function _buy(
            bytes32 poolId,
            address inputToken,
            uint256 inputAmount,
            uint256 minReserveOut,
            uint256 minCplTcoinOut
        ) internal returns (BuyResult memory result) {
            (
                result.selectedPoolId,
                result.reserveAssetId,
                result.reserveAmountUsed,
                result.mrUsed,
                result.cplOut,
                result.charityTopupOut,
                result.resolvedCharityId
            ) = router.buyCplTcoin(poolId, inputToken, inputAmount, minReserveOut, minCplTcoinOut);
        }

        function _preview(bytes32 poolId, address buyer, address inputToken, uint256 inputAmount)
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
            ) = router.previewBuyCplTcoin(poolId, buyer, inputToken, inputAmount);
        }
    }
