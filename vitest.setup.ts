import { vi } from "vitest";

vi.mock("server-only", () => ({}), { virtual: true });
vi.mock("cubid-sdk", async () => import("@shared/stubs/cubid-sdk"));
vi.mock("cubid-wallet", async () => import("@shared/stubs/cubid-wallet"));
vi.mock("cubid-wallet/dist/styles.css", () => ({}), { virtual: true });
vi.mock("cubid-sdk/dist/index.css", () => ({}), { virtual: true });

const indexedDbStub =
  (globalThis as any).indexedDB ??
  ({
    cmp: () => 0,
    open: () => ({ result: undefined, onsuccess: null, onerror: null }),
    deleteDatabase: () => ({ result: undefined, onsuccess: null, onerror: null }),
    databases: async () => [],
  } as unknown as IDBFactory);

(globalThis as any).indexedDB = indexedDbStub;
if (typeof window !== "undefined") {
  (window as any).indexedDB = indexedDbStub;
  (globalThis as any).window = window;
} else {
  (globalThis as any).window = globalThis;
}

function createStorageStub() {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  } as Storage;
}

const currentStorage = (globalThis as any).localStorage;
if (!currentStorage || typeof currentStorage.getItem !== "function") {
  const storageStub = createStorageStub();
  (globalThis as any).localStorage = storageStub;
  if (typeof window !== "undefined") {
    (window as any).localStorage = storageStub;
  }
}

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "test-publishable-key";
