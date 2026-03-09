// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOrchestratorV2 {
    function isSteward(address addr) external view returns (bool);
    function getStewardCount() external view returns (uint256);

    function addCharity(uint256 id, string calldata name, address charity) external;
    function addReserveCurrency(bytes32 code, address token, uint8 decimals) external;
}
