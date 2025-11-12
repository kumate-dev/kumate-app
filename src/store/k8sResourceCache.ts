// Simple in-memory cache for K8s resource lists keyed by event name, with TTL
// Persisted across component unmounts to allow instant rendering when navigating back

type CacheEntry<T> = { items: T[]; expiresAt: number };
const cache = new Map<string, CacheEntry<any>>();

export function getResourceCache<T>(key: string): T[] | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.items;
}

export function setResourceCacheWithTTL<T>(key: string, items: T[], ttlMs: number): void {
  cache.set(key, { items, expiresAt: Date.now() + ttlMs } as CacheEntry<T>);
}

export function clearResourceCache(key: string): void {
  cache.delete(key);
}
