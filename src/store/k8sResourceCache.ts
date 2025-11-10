// Simple in-memory cache for K8s resource lists keyed by event name
// Persisted across component unmounts to allow instant rendering when navigating back

const cache = new Map<string, any[]>();

export function getResourceCache<T>(key: string): T[] | undefined {
  return cache.get(key) as T[] | undefined;
}

export function setResourceCache<T>(key: string, items: T[]): void {
  cache.set(key, items as any[]);
}

export function clearResourceCache(key: string): void {
  cache.delete(key);
}
