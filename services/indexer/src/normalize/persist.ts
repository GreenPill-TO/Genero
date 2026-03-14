import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedEvent } from "../types";
import { buildEventFingerprint } from "./fingerprint";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function toNumericString(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "0";
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  return "0";
}

function pickAddress(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)) {
      return value;
    }
  }

  return ZERO_ADDRESS;
}

function eventTimestampToIso(timestamp: number): string {
  const seconds = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Math.floor(Date.now() / 1000);
  return new Date(seconds * 1000).toISOString();
}

function dedupeEvents(events: NormalizedEvent[]): Array<NormalizedEvent & { fingerprint: string }> {
  const map = new Map<string, NormalizedEvent & { fingerprint: string }>();

  for (const event of events) {
    const fingerprint = buildEventFingerprint(event);
    if (!map.has(fingerprint)) {
      map.set(fingerprint, {
        ...event,
        fingerprint,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    if (a.txHash !== b.txHash) {
      return a.txHash.localeCompare(b.txHash);
    }
    return a.logIndex - b.logIndex;
  });
}

export async function persistNormalizedEvents(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey: string;
  events: NormalizedEvent[];
}) {
  const dedupedEvents = dedupeEvents(options.events);
  if (dedupedEvents.length === 0) {
    return {
      persistedEvents: 0,
      maxBlock: 0,
      lastTxHash: null as string | null,
    };
  }

  const rawRows = dedupedEvents.map((event) => ({
    scope_key: options.scopeKey,
    source: event.source,
    chain_id: event.chainId,
    block_number: event.blockNumber,
    tx_hash: event.txHash,
    log_index: event.logIndex,
    contract_address: event.contractAddress,
    transaction_type: event.transactionType,
    payload: event.payload,
    fingerprint: event.fingerprint,
    indexed_at: new Date().toISOString(),
  }));

  const { error: rawError } = await options.supabase
    .schema("indexer")
    .from("raw_events")
    .upsert(rawRows, { onConflict: "fingerprint", ignoreDuplicates: true });

  if (rawError) {
    throw new Error(`Failed to write raw events: ${rawError.message}`);
  }

  const txByHash = new Map<string, { chainId: number; blockNumber: number; success: boolean; timestamp: number }>();
  for (const event of dedupedEvents) {
    const key = `${event.chainId}:${event.txHash.toLowerCase()}`;
    const existing = txByHash.get(key);
    if (!existing || event.blockNumber > existing.blockNumber) {
      txByHash.set(key, {
        chainId: event.chainId,
        blockNumber: event.blockNumber,
        success: event.success,
        timestamp: event.timestamp,
      });
    }
  }

  const txRows = Array.from(txByHash.entries()).map(([key, value]) => {
    const [, txHash] = key.split(":");
    return {
      chain_id: value.chainId,
      tx_hash: txHash,
      block_number: value.blockNumber,
      date_block: eventTimestampToIso(value.timestamp),
      success: value.success,
      last_seen_at: new Date().toISOString(),
    };
  });

  const { error: txError } = await options.supabase
    .schema("chain_data")
    .from("tx")
    .upsert(txRows, { onConflict: "chain_id,tx_hash" });

  if (txError) {
    throw new Error(`Failed to upsert chain tx rows: ${txError.message}`);
  }

  const transferRows: Record<string, unknown>[] = [];
  const mintRows: Record<string, unknown>[] = [];
  const burnRows: Record<string, unknown>[] = [];
  const poolSwapRows: Record<string, unknown>[] = [];
  const poolDepositRows: Record<string, unknown>[] = [];
  const ownershipRows: Record<string, unknown>[] = [];

  for (const event of dedupedEvents) {
    const payload = event.payload;

    switch (event.transactionType) {
      case "TOKEN_TRANSFER": {
        transferRows.push({
          chain_id: event.chainId,
          tx_hash: event.txHash,
          block_number: event.blockNumber,
          log_index: event.logIndex,
          sender_address: pickAddress(payload, ["from", "_from"]),
          recipient_address: pickAddress(payload, ["to", "_to"]),
          contract_address: event.contractAddress,
          transfer_value: toNumericString(payload.value ?? payload._value),
        });
        break;
      }
      case "TOKEN_MINT": {
        mintRows.push({
          chain_id: event.chainId,
          tx_hash: event.txHash,
          block_number: event.blockNumber,
          log_index: event.logIndex,
          minter_address: pickAddress(payload, ["tokenMinter", "_tokenMinter", "minter", "_minter"]),
          recipient_address: pickAddress(payload, ["to", "_beneficiary", "beneficiary"]),
          contract_address: event.contractAddress,
          mint_value: toNumericString(payload.value ?? payload._value),
        });
        break;
      }
      case "TOKEN_BURN": {
        burnRows.push({
          chain_id: event.chainId,
          tx_hash: event.txHash,
          block_number: event.blockNumber,
          log_index: event.logIndex,
          burner_address: pickAddress(payload, ["tokenBurner", "_tokenBurner", "burner", "_burner"]),
          contract_address: event.contractAddress,
          burn_value: toNumericString(payload.value ?? payload._value),
        });
        break;
      }
      case "POOL_SWAP": {
        poolSwapRows.push({
          chain_id: event.chainId,
          tx_hash: event.txHash,
          block_number: event.blockNumber,
          log_index: event.logIndex,
          initiator_address: pickAddress(payload, ["initiator"]),
          token_in_address: pickAddress(payload, ["tokenIn", "token_in"]),
          token_out_address: pickAddress(payload, ["tokenOut", "token_out"]),
          in_value: toNumericString(payload.amountIn ?? payload.inValue),
          out_value: toNumericString(payload.amountOut ?? payload.outValue),
          contract_address: event.contractAddress,
          fee: toNumericString(payload.fee),
        });
        break;
      }
      case "POOL_DEPOSIT": {
        poolDepositRows.push({
          chain_id: event.chainId,
          tx_hash: event.txHash,
          block_number: event.blockNumber,
          log_index: event.logIndex,
          initiator_address: pickAddress(payload, ["initiator"]),
          token_in_address: pickAddress(payload, ["tokenIn", "token_in"]),
          in_value: toNumericString(payload.amountIn ?? payload.inValue),
          contract_address: event.contractAddress,
        });
        break;
      }
      case "OWNERSHIP_TRANSFERRED": {
        ownershipRows.push({
          chain_id: event.chainId,
          tx_hash: event.txHash,
          block_number: event.blockNumber,
          log_index: event.logIndex,
          previous_owner: pickAddress(payload, ["previousOwner"]),
          new_owner: pickAddress(payload, ["newOwner"]),
          contract_address: event.contractAddress,
        });
        break;
      }
      default:
        break;
    }
  }

  async function upsertIfAny(
    table: "token_transfer" | "token_mint" | "token_burn" | "pool_swap" | "pool_deposit" | "ownership_change",
    rows: Record<string, unknown>[],
    onConflict: string
  ) {
    if (rows.length === 0) {
      return;
    }

    const { error } = await options.supabase
      .schema("chain_data")
      .from(table)
      .upsert(rows, { onConflict });

    if (error) {
      throw new Error(`Failed to upsert ${table} rows: ${error.message}`);
    }
  }

  await upsertIfAny(
    "token_transfer",
    transferRows,
    "chain_id,tx_hash,log_index,contract_address,sender_address,recipient_address,transfer_value"
  );
  await upsertIfAny(
    "token_mint",
    mintRows,
    "chain_id,tx_hash,log_index,contract_address,minter_address,recipient_address,mint_value"
  );
  await upsertIfAny(
    "token_burn",
    burnRows,
    "chain_id,tx_hash,log_index,contract_address,burner_address,burn_value"
  );
  await upsertIfAny(
    "pool_swap",
    poolSwapRows,
    "chain_id,tx_hash,log_index,contract_address,initiator_address,token_in_address,token_out_address,in_value,out_value,fee"
  );
  await upsertIfAny(
    "pool_deposit",
    poolDepositRows,
    "chain_id,tx_hash,log_index,contract_address,initiator_address,token_in_address,in_value"
  );
  await upsertIfAny(
    "ownership_change",
    ownershipRows,
    "chain_id,tx_hash,log_index,contract_address,previous_owner,new_owner"
  );

  const lastEvent = dedupedEvents[dedupedEvents.length - 1];

  return {
    persistedEvents: dedupedEvents.length,
    maxBlock: lastEvent.blockNumber,
    lastTxHash: lastEvent.txHash,
  };
}
