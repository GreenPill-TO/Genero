import {
  decodeEventLog,
  getAddress,
  isAddress,
  keccak256,
  stringToBytes,
  type Address,
  type PublicClient,
} from "viem";
import { trackerEventAbis } from "../discovery/abis";
import type { NormalizedEvent } from "../types";

const TRANSFER_TOPIC = keccak256(stringToBytes("Transfer(address,address,uint256)"));
const MINT_TOPIC = keccak256(stringToBytes("Mint(address,address,uint256)"));
const BURN_TOPIC = keccak256(stringToBytes("Burn(address,uint256)"));
const SWAP_TOPIC = keccak256(
  stringToBytes("Swap(address,address,address,uint256,uint256,uint256)")
);
const DEPOSIT_TOPIC = keccak256(stringToBytes("Deposit(address,address,uint256)"));
const OWNERSHIP_TRANSFERRED_TOPIC = keccak256(
  stringToBytes("OwnershipTransferred(address,address)")
);

function eventTypeFromTopic(topic: string | undefined): string {
  switch ((topic ?? "").toLowerCase()) {
    case TRANSFER_TOPIC.toLowerCase():
      return "TOKEN_TRANSFER";
    case MINT_TOPIC.toLowerCase():
      return "TOKEN_MINT";
    case BURN_TOPIC.toLowerCase():
      return "TOKEN_BURN";
    case SWAP_TOPIC.toLowerCase():
      return "POOL_SWAP";
    case DEPOSIT_TOPIC.toLowerCase():
      return "POOL_DEPOSIT";
    case OWNERSHIP_TRANSFERRED_TOPIC.toLowerCase():
      return "OWNERSHIP_TRANSFERRED";
    default:
      return "UNKNOWN_LOG";
  }
}

function toNumber(value: bigint | number | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return 0;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function pullRpcEvents(options: {
  client: PublicClient;
  chainId: number;
  fromBlock: number;
  toBlock: number;
  trackedAddresses: Address[];
}): Promise<NormalizedEvent[]> {
  if (options.trackedAddresses.length === 0 || options.fromBlock > options.toBlock) {
    return [];
  }

  const blockTimestampCache = new Map<number, number>();
  const collectedEvents: NormalizedEvent[] = [];

  const addressChunks = chunk(options.trackedAddresses, 50);
  for (const addressChunk of addressChunks) {
    const logs = await options.client.getLogs({
      address: addressChunk,
      fromBlock: BigInt(options.fromBlock),
      toBlock: BigInt(options.toBlock),
    });

    for (const log of logs) {
      if (!isAddress(log.address)) {
        continue;
      }

      const blockNumber = Number(log.blockNumber ?? BigInt(0));
      let timestamp = blockTimestampCache.get(blockNumber);

      if (timestamp === undefined) {
        const block = await options.client.getBlock({
          blockNumber: log.blockNumber,
        });

        timestamp = Number(block.timestamp);
        blockTimestampCache.set(blockNumber, timestamp);
      }

      const transactionType = eventTypeFromTopic(log.topics[0]);
      let payload: Record<string, unknown> = {};

      try {
        const decoded = decodeEventLog({
          abi: trackerEventAbis,
          data: log.data,
          topics: log.topics,
          strict: false,
        });

        payload = Object.entries(decoded.args ?? {}).reduce<Record<string, unknown>>(
          (accumulator, [key, value]) => {
            if (typeof key === "string") {
              accumulator[key] =
                typeof value === "bigint"
                  ? value.toString()
                  : Array.isArray(value)
                    ? value.map((entry) => (typeof entry === "bigint" ? entry.toString() : entry))
                    : value;
            }
            return accumulator;
          },
          {}
        );
      } catch {
        payload = {
          topic0: log.topics[0] ?? null,
          topics: log.topics,
          data: log.data,
        };
      }

      collectedEvents.push({
        source: "rpc",
        chainId: options.chainId,
        blockNumber,
        txHash: log.transactionHash,
        logIndex: toNumber(log.logIndex),
        contractAddress: getAddress(log.address),
        success: true,
        timestamp,
        transactionType,
        payload,
      });
    }
  }

  return collectedEvents;
}
