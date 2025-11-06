import { useMemo } from 'react';
import { ALL_NAMESPACES } from '@/constants/k8s';

interface FilterableItem {
  metadata?: {
    namespace?: string;
    name?: string;
    [key: string]: unknown;
  };
}

export function useFilteredItems<T extends FilterableItem>(
  items: T[],
  selectedNamespaces: string[] = [ALL_NAMESPACES],
  q: string,
  keys: string[] = ['name'],
  sortBy: string = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): T[] {
  return useMemo(() => {
    const searchTerm = q.trim().toLowerCase();
    const hasNamespaceFilter =
      selectedNamespaces.length !== 1 || selectedNamespaces[0] !== ALL_NAMESPACES;
    const shouldFilter = searchTerm || hasNamespaceFilter;

    if (!shouldFilter && !sortBy) {
      return items;
    }

    const filteredItems = shouldFilter
      ? items.filter((item) => {
          const { metadata = {} } = item;
          const { namespace } = metadata;

          if (namespace && hasNamespaceFilter && !selectedNamespaces.includes(namespace)) {
            return false;
          }

          if (!searchTerm) return true;

          return keys.some((key) => {
            const value = metadata[key];
            return value != null && String(value).toLowerCase().includes(searchTerm);
          });
        })
      : items;

    if (!sortBy || filteredItems.length <= 1) {
      return filteredItems;
    }

    const sortedItems = [...filteredItems].sort((a, b) => {
      const aValue = String(a.metadata?.[sortBy] ?? '');
      const bValue = String(b.metadata?.[sortBy] ?? '');

      const compareResult = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      return sortOrder === 'asc' ? compareResult : -compareResult;
    });

    return sortedItems;
  }, [items, selectedNamespaces, q, keys, sortBy, sortOrder]);
}
