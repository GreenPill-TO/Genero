// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGovernance {
    function executeProposal(uint256 proposalId) external;
    function cancelProposal(uint256 proposalId) external;
}
