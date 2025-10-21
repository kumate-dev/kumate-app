import { useMemo } from "react";

export function useFilteredItems<T extends { name?: string }>(items: T[], q: string): T[] {
  return useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => (item.name || '').toLowerCase().includes(term));
  }, [items, q]);
}
