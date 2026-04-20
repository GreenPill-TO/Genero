import { vi } from "vitest";

const mockVirtualModule = vi.mock as unknown as (
  path: string,
  factory: () => unknown,
  options: { virtual: true }
) => void;

mockVirtualModule("server-only", () => ({}), { virtual: true });
vi.mock("cubid-sdk", async () => import("@shared/stubs/cubid-sdk"));
vi.mock("cubid-wallet", async () => import("@shared/stubs/cubid-wallet"));
mockVirtualModule("cubid-wallet/dist/styles.css", () => ({}), { virtual: true });
mockVirtualModule("cubid-sdk/dist/index.css", () => ({}), { virtual: true });

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

function installStorageStub(target: typeof globalThis | Window, key: "localStorage") {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: createStorageStub(),
  });
}

// Override the storage binding without touching Node's built-in webstorage getter.
installStorageStub(globalThis, "localStorage");
if (typeof window !== "undefined") {
  installStorageStub(window, "localStorage");
}

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "test-publishable-key";
