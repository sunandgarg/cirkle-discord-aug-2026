const DB_NAME = "cirkle-cache-v1";
const STORE_NAME = "entries";
const SMALL_CACHE_PREFIX = "cirkle:small:";

interface CacheEntry<T> {
  key: string;
  value: T;
  updatedAt: number;
}

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const getCached = async <T>(key: string, maxAgeMs = Infinity): Promise<T | null> => {
  try {
    const db = await openDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        db.close();
        resolve(entry && Date.now() - entry.updatedAt <= maxAgeMs ? entry.value : null);
      };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch {
    return null;
  }
};

export const setCached = async <T>(key: string, value: T): Promise<void> => {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME)
        .put({ key, value, updatedAt: Date.now() } satisfies CacheEntry<T>);
      request.onsuccess = () => { db.close(); resolve(); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch {
    // Caching is an optimization; storage denial must never break the app.
  }
};

export const getSmallCached = <T>(key: string, maxAgeMs = Infinity): T | null => {
  try {
    const raw = localStorage.getItem(`${SMALL_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return Date.now() - entry.updatedAt <= maxAgeMs ? entry.value : null;
  } catch {
    return null;
  }
};

export const setSmallCached = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(`${SMALL_CACHE_PREFIX}${key}`, JSON.stringify({ key, value, updatedAt: Date.now() }));
  } catch {
    // Ignore private-mode and quota failures.
  }
};

export const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const merged = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item }));
  return [...merged.values()].sort((a: any, b: any) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
};
