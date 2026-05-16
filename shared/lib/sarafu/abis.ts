export const sarafuPoolAbi = [
  {
    type: "function",
    name: "tokenRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tokenLimiter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "quoter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "feeAddress",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "feePpm",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getQuote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_outToken", type: "address" },
      { name: "_inToken", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

export const sarafuTokenRegistryAbi = [
  {
    type: "function",
    name: "entryCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "entry",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "entries",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const sarafuQuoterAbi = [
  {
    type: "function",
    name: "valueFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_outToken", type: "address" },
      { name: "_inToken", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Candidate write ABI entries used for transaction planning / encoding where supported by pool versions.
export const sarafuPoolWriteAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_outToken", type: "address" },
      { name: "_inToken", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const sarafuLimiterAbi = [
  {
    type: "function",
    name: "limitOf",
    stateMutability: "view",
    inputs: [
      { name: "_token", type: "address" },
      { name: "_holder", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
