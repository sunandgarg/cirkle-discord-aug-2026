const CACHE_PREFIX = "forum_cache_";
const CACHE_TS_PREFIX = "forum_cache_ts_";
const MAX_CACHE_AGE_MS = 5 * 60 * 1000; // 5 minutes stale threshold
const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB guard

// ─── Layer 1: In-memory singleton cache ───
class MessageCacheStore {
  private cache = new Map<string, any[]>();
  private timestamps = new Map<string, number>();

  getKey(scopeType: string, scopeKey: string) {
    return `${scopeType}_${scopeKey}`;
  }

  get(scopeType: string, scopeKey: string): any[] | null {
    const key = this.getKey(scopeType, scopeKey);
    return this.cache.get(key) ?? null;
  }

  set(scopeType: string, scopeKey: string, posts: any[]) {
    const key = this.getKey(scopeType, scopeKey);
    this.cache.set(key, posts);
    this.timestamps.set(key, Date.now());
  }

  isStale(scopeType: string, scopeKey: string): boolean {
    const key = this.getKey(scopeType, scopeKey);
    const ts = this.timestamps.get(key);
    if (!ts) return true;
    return Date.now() - ts > MAX_CACHE_AGE_MS;
  }

  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

export const messageCache = new MessageCacheStore();

// ─── Layer 2: localStorage cache ───
export const getCachedPosts = (scopeType: string, scopeKey: string): any[] | null => {
  // Try memory first
  const memCached = messageCache.get(scopeType, scopeKey);
  if (memCached) return memCached;

  // Fall back to localStorage
  try {
    const key = `${CACHE_PREFIX}${scopeType}_${scopeKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Populate memory cache too
    messageCache.set(scopeType, scopeKey, parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const isCacheStale = (scopeType: string, scopeKey: string): boolean => {
  // Check memory first
  if (!messageCache.isStale(scopeType, scopeKey)) return false;

  try {
    const tsKey = `${CACHE_TS_PREFIX}${scopeType}_${scopeKey}`;
    const ts = localStorage.getItem(tsKey);
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) > MAX_CACHE_AGE_MS;
  } catch {
    return true;
  }
};

export const setCachedPosts = (scopeType: string, scopeKey: string, posts: any[]) => {
  // Always set in memory
  messageCache.set(scopeType, scopeKey, posts);

  try {
    const key = `${CACHE_PREFIX}${scopeType}_${scopeKey}`;
    const tsKey = `${CACHE_TS_PREFIX}${scopeType}_${scopeKey}`;
    const serialized = JSON.stringify(posts);
    
    if (serialized.length > MAX_TOTAL_SIZE) return;
    
    try {
      localStorage.setItem(key, serialized);
      localStorage.setItem(tsKey, Date.now().toString());
    } catch {
      evictOldCaches();
      try {
        localStorage.setItem(key, serialized);
        localStorage.setItem(tsKey, Date.now().toString());
      } catch {}
    }
  } catch {}
};

// ─── Unread dots persistence ───
const UNREAD_KEY = "forum_unread_dots";

export const getUnreadChannels = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(UNREAD_KEY);
    if (!raw) {
      // First load defaults
      const defaults: Record<string, boolean> = {
        "GLOBAL_IIT_ALL_tech": true,
        "GLOBAL_IIT_ALL_jobs": true,
      };
      localStorage.setItem(UNREAD_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const setChannelRead = (scopeType: string, scopeKey: string) => {
  try {
    const current = getUnreadChannels();
    const key = `${scopeType}_${scopeKey}`;
    delete current[key];
    localStorage.setItem(UNREAD_KEY, JSON.stringify(current));
  } catch {}
};

export const setChannelUnread = (scopeType: string, scopeKey: string) => {
  try {
    const current = getUnreadChannels();
    const key = `${scopeType}_${scopeKey}`;
    current[key] = true;
    localStorage.setItem(UNREAD_KEY, JSON.stringify(current));
  } catch {}
};

const evictOldCaches = () => {
  try {
    const entries: { key: string; ts: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_TS_PREFIX)) {
        const ts = parseInt(localStorage.getItem(k) || "0", 10);
        entries.push({ key: k.replace(CACHE_TS_PREFIX, ""), ts });
      }
    }
    entries.sort((a, b) => a.ts - b.ts);
    const toRemove = entries.slice(0, Math.ceil(entries.length / 2));
    toRemove.forEach(({ key }) => {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      localStorage.removeItem(`${CACHE_TS_PREFIX}${key}`);
    });
  } catch {}
};
