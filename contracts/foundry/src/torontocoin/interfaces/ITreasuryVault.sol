// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryVault {
    function depositReserveFrom(address from, address token, uint256 amount) external returns (bool);
    function withdrawReserveTo(address to, address token, uint256 amount) external returns (bool);
    function reserveBalance(address token) external view returns (uint256);
}
