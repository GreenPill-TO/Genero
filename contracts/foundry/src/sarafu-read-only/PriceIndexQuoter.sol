// Author: Louis Holbrook <dev@holbrook.no> 0826EDA1702D1E87C6E2875121D2E7BB88C2A746
// Author: Mohamed Sohail <sohail@grassecon.org>
// SPDX-License-Identifier: AGPL-3.0-or-later
// File-Version: 1
// Description: ACL-enabled ERC20 token swap quoter that queries a price index for the latest exchange rates.
pragma solidity ^0.8.0;

contract PriceIndexQuoter {
    // Implements EIP173
    address public owner;
    
    uint256 public constant DEFAULT_EXCHANGE_RATE = 10 ** 4;

    mapping(address => uint256) public priceIndex;

    event PriceIndexUpdated(address _tokenAddress, uint256 _exchangeRate);
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {
        owner = msg.sender;
    }

    function setPriceIndexValue(
        address _tokenAddress,
        uint256 _exchangeRate
    ) public returns (uint256) {
        require(owner == msg.sender, "ERR_NOT_OWNER");
        priceIndex[_tokenAddress] = _exchangeRate;
        emit PriceIndexUpdated(_tokenAddress, _exchangeRate);
        return _exchangeRate;
    }

    // Implements TokenQuote
    function valueFor(
        address _outToken,
        address _inToken,
        uint256 _value
    ) public returns (uint256) {
        uint8 dout;
        uint8 din;
        bool r;
        bytes memory v;

        uint256 inExchangeRate = DEFAULT_EXCHANGE_RATE;
        uint256 outExchangeRate = DEFAULT_EXCHANGE_RATE;

        if (priceIndex[_inToken] > 0) {
            inExchangeRate = priceIndex[_inToken];
        }

        if (priceIndex[_outToken] > 0) {
            outExchangeRate = priceIndex[_outToken];
        }

        (r, v) = _outToken.call(abi.encodeWithSignature("decimals()"));
        require(r, "ERR_TOKEN_OUT");
        dout = abi.decode(v, (uint8));

        (r, v) = _inToken.call(abi.encodeWithSignature("decimals()"));
        require(r, "ERR_TOKEN_IN");
        din = abi.decode(v, (uint8));

        if (din == dout) {
            return determineOutput(_value, inExchangeRate, outExchangeRate);
        }

        uint256 d = din > dout ? 10 ** ((din - dout)) : 10 ** ((dout - din));
        if (din > dout) {
            return determineOutput(_value / d, inExchangeRate, outExchangeRate);
        } else {
            return determineOutput(_value * d, inExchangeRate, outExchangeRate);
        }
    }

    // When testing with forge convert to a public function
    // https://github.com/foundry-rs/foundry/issues/1040
    function determineOutput(uint256 inputValue, uint256 inExchangeRate, uint256 outExchangeRate) internal pure returns (uint256) {
        return (inputValue * inExchangeRate) / outExchangeRate;
    }

    // Implements EIP173
    function transferOwnership(address _newOwner) public returns (bool) {
        address oldOwner;
        require(msg.sender == owner, "ERR_AXX");

        oldOwner = owner;
        owner = _newOwner;

        emit OwnershipTransferred(oldOwner, owner);
        return true;
    }

    // Implements EIP165
    function supportsInterface(bytes4 _sum) public pure returns (bool) {
        if (_sum == 0x01ffc9a7) {
            // ERC165
            return true;
        }
        if (_sum == 0x9493f8b2) {
            // ERC173
            return true;
        }
        if (_sum == 0xdbb21d40) {
            // TokenQuote
            return true;
        }
        return false;
    }
}
