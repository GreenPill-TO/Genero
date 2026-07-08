# Sarafu UI
https://sarafu.network/pools/0xA6f024Ad53766d332057d5e40215b695522ee3dE
Pool Address: tcoin48.sarafu.eth (https://celoscan.io/address/0xA6f024Ad53766d332057d5e40215b695522ee3dE#asset-tokens)
Owner: tcoin.sarafu.eth (https://celoscan.io/address/0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624)

# Contract details
0xA6f024Ad53766d332057d5e40215b695522ee3dE
aka the "Pool" contract

# Constructor Arguments
00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000006000000000000000000000000d3ae8c0f49680e53ef76546af18d45df4654af810000000000000000000000009ac2fef4b3672825bb7560377c8bed7e255e0fef000000000000000000000000000000000000000000000000000000000000001a546f726f6e746f27732043697263756c61722045636f6e6f6d79000000000000000000000000000000000000000000000000000000000000000000000000000554434f494e000000000000000000000000000000000000000000000000000000

Arg [0] _name (string): Toronto's Circular Economy
Arg [1] _symbol (string): TCOIN
Arg [2] _decimals (uint8): 6
Arg [3] _tokenRegistry (address): 0xD3aE8C0f49680E53EF76546af18d45DF4654Af81
Arg [4] _tokenLimiter (address): 0x9ac2fef4b3672825BB7560377c8bEd7E255e0FEF

# Indexer header
Contract name: SwapPool
Compiler version: v0.8.25+commit.b61c2a91
EVM version: istanbul
Optimization enabled: false
Verified at: Nov 6, 2025 9:54:04 AM
Contract file path: SwapPool.sol

# Pool Contracts
View and manage the contracts that make up this swap pool. When transferring pool ownership, all contract ownerships will be transferred together.

## Main Pool Contract
Pool Address
tcoin48.sarafu.eth
The main swap pool contract address

Owner
tcoin.sarafu.eth
Current owner of the pool contract

## Fee Configuration
Fee Address
tcoin.sarafu.eth
Address that receives collected fees

Fee Percentage
3%
Current fee percentage for swaps

## Core Contracts
Quoter
0xD870DEe32489b59Aa71723f6017812FB078EE371
Price quotation contract for swap calculations

Token Registry
0xD3aE8C0f49680E53EF76546af18d45DF4654Af81
Registry contract managing pool vouchers

Token Limiter
0x9ac2fef4b3672825BB7560377c8bEd7E255e0FEF
Contract enforcing swap limits and restrictions
