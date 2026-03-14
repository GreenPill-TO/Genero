pragma solidity >=0.8.0;

// SPDX-License-Identifier: AGPL-3.0-or-later

contract TokenUniqueSymbolIndex {
	mapping(address => bool) isWriter;
	mapping ( bytes32 => uint256 ) registry;
	mapping ( address => bytes32 ) tokenIndex;
	address[] tokens;

	// Implements EIP173
	address public owner;

	// Implements Registry
	bytes32[] public identifierList;

	// Implements EIP173
	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

	// Implements AccountsIndex
	event AddressKey(bytes32 indexed _symbol, address _token);

	// Implements AccountsIndex
	event AddressAdded(address _token);

	// Implements AccountsIndexMutable
	event AddressRemoved(address _token);

	// Implements Writer
	event WriterAdded(address _writer);

	// Implements Writer
	event WriterDeleted(address _writer);

	constructor() {
		owner = msg.sender;
		tokens.push(address(0));
		identifierList.push(bytes32(0));
	}

	// Implements AccountsIndex
	function entry(uint256 _idx) public view returns ( address ) {
		return tokens[_idx + 1];
	}

	// Implements RegistryClient
	function addressOf(bytes32 _key) public view returns ( address ) {
		uint256 idx;

		idx = registry[_key];
		return tokens[idx];
	}

	// Attempt to register the token at the given address.
	// Will revet if symbol cannot be retrieved, or if symbol already exists.
	function register(address _token) public returns (bool) {
		require(isWriter[msg.sender]);

		bytes memory token_symbol;
		bytes32 token_symbol_key;
		uint256 idx;

		(bool _ok, bytes memory _r) = _token.call(abi.encodeWithSignature('symbol()'));
		require(_ok);

		token_symbol = abi.decode(_r, (bytes));
		require(token_symbol.length <= 32, 'ERR_TOKEN_SYMBOL_TOO_LONG');
		token_symbol_key = bytes32(token_symbol);

		idx = registry[token_symbol_key];
		require(idx == 0);

		registry[token_symbol_key] = tokens.length;
		tokens.push(_token);
		identifierList.push(token_symbol_key);
		tokenIndex[_token] = token_symbol_key;

		emit AddressKey(token_symbol_key, _token);
		emit AddressAdded(_token);
		return true;
	}

	// Implements AccountsIndex
	function add(address _token) public returns (bool) {
		return register(_token);
	}

	// Implements AccountsIndex
	function time(address _token) public pure returns(uint256) {
		_token;
		return 0;
	}

	// Implements AccountsIndexMutable
	function remove(address _token) external returns (bool) {
		uint256 i;
		uint256 l;

		require(isWriter[msg.sender] || msg.sender == owner, 'ERR_AXX');
		require(tokenIndex[_token] != bytes32(0), 'ERR_NOT_FOUND');

		l = tokens.length - 1;
		i = registry[tokenIndex[_token]];
		if (i < l) {
			tokens[i] = tokens[l];
			identifierList[i] = identifierList[l];
		}
		registry[tokenIndex[tokens[i]]] = i;
		tokens.pop();
		identifierList.pop();
		registry[tokenIndex[_token]] = 0;
		tokenIndex[_token] = bytes32(0);

		emit AddressRemoved(_token);
		return true;
	}

	// Implements AccountsIndexMutable
	function activate(address _token) public pure returns(bool) {
		_token;
		return false;
	}

	// Implements AccountsIndexMutable
	function deactivate(address _token) public pure returns(bool) {
		_token;
		return false;
	}


	// Implements AccountsIndex
	function entryCount() public view returns ( uint256 ) {
		return tokens.length - 1;
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

	// Implements Writer
	function addWriter(address _writer) public returns (bool) {
		require(owner == msg.sender);
		isWriter[_writer] = true;

		emit WriterAdded(_writer);

		return true;
	}

	// Implements Writer
	function deleteWriter(address _writer) public returns (bool) {
		require(owner == msg.sender);
		delete isWriter[_writer];

		emit WriterDeleted(_writer);

		return true;
	}

	// Implements Registry
	function identifier(uint256 _idx) public view returns(bytes32) {
		return identifierList[_idx + 1];
	}

	// Implements Registry
	function identifierCount() public view returns(uint256) {
		return identifierList.length - 1;
	}

	// Implements AccountsIndex	
	function have(address _token) public view returns(bool) {
		return tokenIndex[_token] != bytes32(0x0);
	}

	// Implements EIP165
	function supportsInterface(bytes4 _sum) public pure returns (bool) {
		if (_sum == 0xeffbf671) { // Registry
			return true;
		}
		if (_sum == 0xb7bca625) { // AccountsIndex 
			return true;
		}
		if (_sum == 0x9479f0ae) { // AccountsIndexMutable
			return true;
		}
		if (_sum == 0x01ffc9a7) { // EIP165
			return true;
		}
		if (_sum == 0x9493f8b2) { // EIP173
			return true;
		}
		if (_sum == 0x80c84bd6) { // Writer
			return true;
		}
		return false;
	}
}
