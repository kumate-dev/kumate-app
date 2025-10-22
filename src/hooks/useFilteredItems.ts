import { useMemo } from 'react';
import { ALL_NAMESPACES } from '../constants/k8s';

export function useFilteredItems<T extends { name?: string; namespace?: string }>(
  items: T[],
  selectedNamespaces: string[] = [ALL_NAMESPACES],
  q: string,
  keys: (keyof T)[] = ['name'],
  sortBy: keyof T = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): T[] {
  return useMemo(() => {
    const term = q.trim().toLowerCase();

    const filtered =
      term || selectedNamespaces.length !== 1 || selectedNamespaces[0] !== ALL_NAMESPACES
        ? items.filter((item) => {
            if (
              item.namespace &&
              !selectedNamespaces.includes(ALL_NAMESPACES) &&
              !selectedNamespaces.includes(item.namespace)
            ) {
              return false;
            }

            if (!term) return true;

            return keys.some((key) => {
              const val = item[key];
              return val != null && String(val).toLowerCase().includes(term);
            });
          })
        : items;

    if (!filtered.length) return filtered;

    return filtered.sort((a, b) => {
      const aVal = a[sortBy] ?? '';
      const bVal = b[sortBy] ?? '';

      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal), undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        : String(bVal).localeCompare(String(aVal), undefined, {
            numeric: true,
            sensitivity: 'base',
          });
    });
  }, [items, selectedNamespaces, q, keys, sortBy, sortOrder]);
}
