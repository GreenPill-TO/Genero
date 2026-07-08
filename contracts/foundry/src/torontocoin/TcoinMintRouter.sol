// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";
import {ITreasuryMinting} from "./interfaces/ITreasuryMinting.sol";

contract TcoinMintRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error DeadlineExpired();
    error InvalidAddress();
    error InvalidAssetId();
    error InputTokenNotEnabled(address token);
    error InvalidAmount();
    error SwapReturnedInsufficientCadm(uint256 expectedMin, uint256 actual);
    error TreasuryMintReturnedInsufficientTcoin(uint256 expectedMin, uint256 actual);
    error RecipientZeroAddress();

    event SwapAdapterUpdated(address indexed oldSwapAdapter, address indexed newSwapAdapter, address indexed actor);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury, address indexed actor);
    event CadmConfigUpdated(
        address indexed oldCadmToken,
        address indexed newCadmToken,
        bytes32 oldCadmAssetId,
        bytes32 newCadmAssetId,
        address actor
    );
    event InputTokenStatusUpdated(address indexed token, bool enabled, address indexed actor);
    event UsdcTokenUpdated(address indexed oldUsdcToken, address indexed newUsdcToken, address indexed actor);

    event MintTcoinWithTokenExecuted(
        address indexed caller,
        address indexed recipient,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 cadmOut,
        uint256 tcoinOut,
        uint256 requestedCharityId
    );

    event RefundIssued(address indexed token, address indexed to, uint256 amount);

    address public swapAdapter;
    address public treasury;
    address public cadmToken;
    bytes32 public cadmAssetId;
    mapping(address => bool) public enabledInputToken;
    address public usdcToken;

    constructor(
        address initialOwner,
        address swapAdapter_,
        address treasury_,
        address cadmToken_,
        bytes32 cadmAssetId_,
        address usdcToken_
    ) {
        if (initialOwner == address(0)) revert InvalidAddress();
        _transferOwnership(initialOwner);

        _setSwapAdapter(swapAdapter_);
        _setTreasury(treasury_);
        _setCadmConfig(cadmToken_, cadmAssetId_);
        _setUsdcToken(usdcToken_);
    }

    function mintTcoinWithToken(
        address tokenIn,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 minTcoinOut,
        uint256 deadline,
        address recipient,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) external nonReentrant whenNotPaused returns (uint256 tcoinOut) {
        return _mintTcoinWithToken(
            tokenIn, amountIn, minCadmOut, minTcoinOut, deadline, recipient, requestedCharityId, swapData
        );
    }

    function mintTcoinWithUSDC(
        uint256 usdcAmountIn,
        uint256 minCadmOut,
        uint256 minTcoinOut,
        uint256 deadline,
        address recipient,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) external nonReentrant whenNotPaused returns (uint256 tcoinOut) {
        return _mintTcoinWithToken(
            usdcToken, usdcAmountIn, minCadmOut, minTcoinOut, deadline, recipient, requestedCharityId, swapData
        );
    }

    function _mintTcoinWithToken(
        address tokenIn,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 minTcoinOut,
        uint256 deadline,
        address recipient,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) internal returns (uint256 tcoinOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (amountIn == 0) revert InvalidAmount();
        if (recipient == address(0)) revert RecipientZeroAddress();
        if (!enabledInputToken[tokenIn]) revert InputTokenNotEnabled(tokenIn);

        uint256 initialTokenInBalance = IERC20(tokenIn).balanceOf(address(this));
        uint256 initialCadmBalance = IERC20(cadmToken).balanceOf(address(this));

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 cadmOut = _swapToCadm(tokenIn, amountIn, minCadmOut, deadline, swapData);

        tcoinOut = _mintTcoinFromCadm(cadmOut, minTcoinOut, requestedCharityId);
        IERC20(ITreasuryMinting(treasury).tcoinToken()).safeTransfer(recipient, tcoinOut);

        _refundSurplus(tokenIn, msg.sender, initialTokenInBalance);
        if (tokenIn != cadmToken) {
            _refundSurplus(cadmToken, msg.sender, initialCadmBalance);
        }

        emit MintTcoinWithTokenExecuted(msg.sender, recipient, tokenIn, amountIn, cadmOut, tcoinOut, requestedCharityId);
    }

    function previewMintTcoinWithToken(
        address tokenIn,
        uint256 amountIn,
        uint256 requestedCharityId,
        bytes calldata swapData
    ) external view returns (uint256 cadmOut, uint256 tcoinOut) {
        if (!enabledInputToken[tokenIn]) revert InputTokenNotEnabled(tokenIn);
        if (amountIn == 0) revert InvalidAmount();

        if (tokenIn == cadmToken) {
            cadmOut = amountIn;
        } else {
            cadmOut = ISwapAdapter(swapAdapter).previewSwapToCadm(tokenIn, cadmToken, amountIn, swapData);
        }

        (tcoinOut,,,,) = ITreasuryMinting(treasury).previewMint(cadmAssetId, cadmOut, requestedCharityId);
    }

    function setSwapAdapter(address swapAdapter_) external onlyOwner {
        _setSwapAdapter(swapAdapter_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function setCadmConfig(address cadmToken_, bytes32 cadmAssetId_) external onlyOwner {
        _setCadmConfig(cadmToken_, cadmAssetId_);
    }

    function setInputTokenEnabled(address token, bool enabled) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        enabledInputToken[token] = enabled;
        emit InputTokenStatusUpdated(token, enabled, msg.sender);
    }

    function setUsdcToken(address usdcToken_) external onlyOwner {
        _setUsdcToken(usdcToken_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _swapToCadm(
        address tokenIn,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 deadline,
        bytes calldata swapData
    ) internal returns (uint256 cadmOut) {
        if (tokenIn == cadmToken) {
            cadmOut = amountIn;
        } else {
            uint256 cadmBefore = IERC20(cadmToken).balanceOf(address(this));
            _approveExact(tokenIn, swapAdapter, amountIn);

            ISwapAdapter(swapAdapter).swapToCadm(tokenIn, cadmToken, amountIn, minCadmOut, deadline, swapData);

            uint256 cadmAfter = IERC20(cadmToken).balanceOf(address(this));
            cadmOut = cadmAfter - cadmBefore;
        }

        if (cadmOut < minCadmOut) {
            revert SwapReturnedInsufficientCadm(minCadmOut, cadmOut);
        }
    }

    function _mintTcoinFromCadm(uint256 cadmOut, uint256 minTcoinOut, uint256 requestedCharityId)
        internal
        returns (uint256 tcoinOut)
    {
        address tcoin = ITreasuryMinting(treasury).tcoinToken();
        address treasuryVault = ITreasuryMinting(treasury).treasury();
        if (tcoin == address(0)) revert InvalidAddress();
        if (treasuryVault == address(0)) revert InvalidAddress();

        uint256 tcoinBefore = IERC20(tcoin).balanceOf(address(this));
        _approveExact(cadmToken, treasuryVault, cadmOut);

        ITreasuryMinting(treasury).depositAndMint(cadmAssetId, cadmOut, requestedCharityId, minTcoinOut);

        uint256 tcoinAfter = IERC20(tcoin).balanceOf(address(this));
        uint256 mintedByBalance = tcoinAfter - tcoinBefore;

        tcoinOut = mintedByBalance;

        if (tcoinOut < minTcoinOut) {
            revert TreasuryMintReturnedInsufficientTcoin(minTcoinOut, tcoinOut);
        }
    }

    function _approveExact(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        erc20.safeApprove(spender, 0);
        erc20.safeApprove(spender, amount);
    }

    function _refundSurplus(address token, address to, uint256 initialBalance) internal {
        uint256 current = IERC20(token).balanceOf(address(this));
        if (current <= initialBalance) return;

        uint256 refundAmount = current - initialBalance;
        IERC20(token).safeTransfer(to, refundAmount);
        emit RefundIssued(token, to, refundAmount);
    }

    function _setSwapAdapter(address swapAdapter_) internal {
        if (swapAdapter_ == address(0)) revert InvalidAddress();
        address oldSwapAdapter = swapAdapter;
        swapAdapter = swapAdapter_;
        emit SwapAdapterUpdated(oldSwapAdapter, swapAdapter_, msg.sender);
    }

    function _setTreasury(address treasury_) internal {
        if (treasury_ == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = treasury_;
        emit TreasuryUpdated(oldTreasury, treasury_, msg.sender);
    }

    function _setCadmConfig(address cadmToken_, bytes32 cadmAssetId_) internal {
        if (cadmToken_ == address(0)) revert InvalidAddress();
        if (cadmAssetId_ == bytes32(0)) revert InvalidAssetId();

        address oldCadmToken = cadmToken;
        bytes32 oldCadmAssetId = cadmAssetId;

        cadmToken = cadmToken_;
        cadmAssetId = cadmAssetId_;

        emit CadmConfigUpdated(oldCadmToken, cadmToken_, oldCadmAssetId, cadmAssetId_, msg.sender);
    }

    function _setUsdcToken(address usdcToken_) internal {
        if (usdcToken_ == address(0)) revert InvalidAddress();
        address oldUsdcToken = usdcToken;
        usdcToken = usdcToken_;
        emit UsdcTokenUpdated(oldUsdcToken, usdcToken_, msg.sender);
    }
}
