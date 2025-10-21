import { useMemo } from 'react';
import { ALL_NAMESPACES } from '../constants/k8s';

export function useFilteredItems<T extends { name?: string; namespace?: string }>(
  items: T[],
  selectedNamespaces: string[] = [ALL_NAMESPACES],
  q: string,
  keys: (keyof T)[] = ['name']
): T[] {
  return useMemo(() => {
    const term = q.trim().toLowerCase();

    return items.filter((item) => {
      if (
        item.namespace &&
        !selectedNamespaces.includes(ALL_NAMESPACES) &&
        !selectedNamespaces.includes(item.namespace)
      ) {
        return false;
      }

      if (!term) return true;
      return keys.some((key) => {
        const value = item[key];
        return value != null && String(value).toLowerCase().includes(term);
      });
    });
  }, [items, selectedNamespaces, q, keys]);
}
