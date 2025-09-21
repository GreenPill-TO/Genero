export interface TransferRecordSnapshot {
  transactionId: number | null;
  raw: unknown;
}

const CANDIDATE_KEYS = [
  "transaction_id",
  "transactionId",
  "trx_entry_id",
  "act_transaction_id",
  "id",
];

const MAX_DEPTH = 5;

const coerceToNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const inspectValue = (value: unknown, depth = 0): number | null => {
  if (value == null || depth > MAX_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = inspectValue(item, depth + 1);
      if (result != null) {
        return result;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of CANDIDATE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        const candidate = coerceToNumber(record[key]);
        if (candidate != null) {
          return candidate;
        }
      }
    }

    for (const entry of Object.values(record)) {
      const nested = inspectValue(entry, depth + 1);
      if (nested != null) {
        return nested;
      }
    }

    return null;
  }

  return coerceToNumber(value);
};

export const extractTransactionId = (value: unknown): number | null =>
  inspectValue(value);

export const normaliseTransferResult = (
  raw: unknown
): TransferRecordSnapshot | null => {
  if (raw == null) {
    return null;
  }

  return {
    transactionId: extractTransactionId(raw),
    raw,
  };
};
