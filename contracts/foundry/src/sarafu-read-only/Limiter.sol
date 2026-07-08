pragma solidity ^0.8.0;

// Author:	Louis Holbrook <dev@holbrook.no> 0826EDA1702D1E87C6E2875121D2E7BB88C2A746
// SPDX-License-Identifier: AGPL-3.0-or-later
// File-Version: 1
// Description: Registry of allowed ERC20 balance limits per-token and per-holder.

contract Limiter {
	address public owner;

	mapping ( address => mapping ( address => uint256 ) ) limit;

	// EIP173
	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner); // EIP173

	constructor() {
		owner = msg.sender;
	}

	function limitOf(address _token, address _holder) public view returns (uint256) {
		return limit[_token][_holder];
	}

	function setLimit(address _token, uint256 _value) public {
		limit[_token][msg.sender] = _value;
	}

	function setLimitFor(address _token, address _holder, uint256 _value) public {
		uint256 sz;
		require(msg.sender == owner ||  msg.sender == _holder, 'ERR_AXX');
		assembly {
			sz := extcodesize(_holder)
		}
		require(sz > 0, 'ERR_ACCOUNT');
		limit[_token][_holder] = _value;
	}

	// Implements EIP173
	function transferOwnership(address _newOwner) public returns (bool) {
		address oldOwner;

		require(msg.sender == owner);
		oldOwner = owner;
		owner = _newOwner;

		emit OwnershipTransferred(oldOwner, owner);
		return true;
	}

	// Implements EIP165
	function supportsInterface(bytes4 _sum) public pure returns (bool) {
		if (_sum == 0x01ffc9a7) { // ERC165
			return true;
		}
		if (_sum == 0x9493f8b2) { // ERC173
			return true;
		}
		if (_sum == 0x23778613) { // TokenLimit
			return true;
		}
		return false;
	}
}
