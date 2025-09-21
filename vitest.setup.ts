const indexedDbStub =
  (globalThis as any).indexedDB ??
  ({
    open: () => ({ result: undefined, onsuccess: null, onerror: null }),
    deleteDatabase: () => ({ result: undefined, onsuccess: null, onerror: null }),
    databases: async () => [],
  } as IDBFactory);

(globalThis as any).indexedDB = indexedDbStub;
if (typeof window !== "undefined") {
  (window as any).indexedDB = indexedDbStub;
  (globalThis as any).window = window;
} else {
  (globalThis as any).window = globalThis;
}
