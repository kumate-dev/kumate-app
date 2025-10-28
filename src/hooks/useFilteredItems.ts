import { useMemo } from 'react';
import { ALL_NAMESPACES } from '@/constants/k8s';

export function useFilteredItems<T>(
  items: T[],
  selectedNamespaces: string[] = [ALL_NAMESPACES],
  q: string,
  keys: string[] = ['name'],
  sortBy: string = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): T[] {
  return useMemo(() => {
    const term = q.trim().toLowerCase();

    const filtered =
      term || selectedNamespaces.length !== 1 || selectedNamespaces[0] !== ALL_NAMESPACES
        ? items.filter((item) => {
            const meta: any = (item as any).metadata ?? {};

            if (
              meta.namespace &&
              !selectedNamespaces.includes(ALL_NAMESPACES) &&
              !selectedNamespaces.includes(meta.namespace)
            ) {
              return false;
            }

            if (!term) return true;

            return keys.some((key) => {
              const val = meta[key];
              return val != null && String(val).toLowerCase().includes(term);
            });
          })
        : items;

    if (!filtered.length) return filtered;

    return filtered.sort((a, b) => {
      const aVal = ((a as any).metadata?.[sortBy] ?? '') as string;
      const bVal = ((b as any).metadata?.[sortBy] ?? '') as string;

      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
        : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [items, selectedNamespaces, q, keys, sortBy, sortOrder]);
}
