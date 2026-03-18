// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITCOINToken {
    function decimals() external view returns (uint8);
    function mint(address to, uint256 amount, bytes calldata data) external;
    function mintTo(address beneficiary, uint256 amount) external returns (bool);
    function burn(uint256 amount) external returns (bool);
    function setExpirePeriod(uint256 expirePeriod) external;
}
