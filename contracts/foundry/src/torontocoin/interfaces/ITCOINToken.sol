// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITCOINToken {
    function decimals() external view returns (uint8);
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    function updateDemurrageRate(uint256 newRate) external;
}
