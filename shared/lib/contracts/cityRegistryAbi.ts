export const cityRegistryAbi = [
  {
    type: "function",
    name: "getActiveContracts",
    stateMutability: "view",
    inputs: [{ name: "cityId", type: "bytes32" }],
    outputs: [
      {
        name: "record",
        type: "tuple",
        components: [
          { name: "version", type: "uint64" },
          { name: "createdAt", type: "uint64" },
          { name: "promotedAt", type: "uint64" },
          { name: "chainId", type: "uint256" },
          {
            name: "contracts",
            type: "tuple",
            components: [
              { name: "tcoin", type: "address" },
              { name: "ttc", type: "address" },
              { name: "cad", type: "address" },
              { name: "orchestrator", type: "address" },
              { name: "oracleRouter", type: "address" },
              { name: "voting", type: "address" },
            ],
          },
          { name: "metadataURI", type: "string" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const;
