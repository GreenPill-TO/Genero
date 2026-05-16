// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    using SafeERC20 for IERC20;

    error ZeroAddressOwner();
    error ZeroAddressToken();
    error ZeroAddressTarget();
    error ZeroAddressCaller();
    error ZeroAmount();
    error Unauthorized();
    error InsufficientReserveBalance(address token, uint256 requested, uint256 available);
    error SameAuthorizationState(address caller, bool authorized);

    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ReserveDeposited(address indexed actor, address indexed from, address indexed token, uint256 amount);
    event ReserveWithdrawn(address indexed actor, address indexed to, address indexed token, uint256 amount);
    event EmergencySweep(address indexed actor, address indexed token, address indexed to, uint256 amount);

    mapping(address => bool) public authorizedCallers;

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
    }

    modifier onlyAuthorizedCaller() {
        if (!authorizedCallers[msg.sender]) revert Unauthorized();
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert ZeroAddressCaller();
        if (authorizedCallers[caller] == authorized) revert SameAuthorizationState(caller, authorized);

        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function depositReserveFrom(address from, address token, uint256 amount)
        external
        onlyAuthorizedCaller
        returns (bool)
    {
        if (from == address(0)) revert ZeroAddressTarget();
        if (token == address(0)) revert ZeroAddressToken();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(from, address(this), amount);
        emit ReserveDeposited(msg.sender, from, token, amount);
        return true;
    }

    function withdrawReserveTo(address to, address token, uint256 amount) external onlyAuthorizedCaller returns (bool) {
        if (to == address(0)) revert ZeroAddressTarget();
        if (token == address(0)) revert ZeroAddressToken();
        if (amount == 0) revert ZeroAmount();

        uint256 available = IERC20(token).balanceOf(address(this));
        if (available < amount) revert InsufficientReserveBalance(token, amount, available);

        IERC20(token).safeTransfer(to, amount);
        emit ReserveWithdrawn(msg.sender, to, token, amount);
        return true;
    }

    function reserveBalance(address token) external view returns (uint256) {
        if (token == address(0)) revert ZeroAddressToken();
        return IERC20(token).balanceOf(address(this));
    }

    function emergencySweep(address token, address to, uint256 amount) external onlyOwner returns (bool) {
        if (token == address(0)) revert ZeroAddressToken();
        if (to == address(0)) revert ZeroAddressTarget();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
        emit EmergencySweep(msg.sender, token, to, amount);
        return true;
    }
}
