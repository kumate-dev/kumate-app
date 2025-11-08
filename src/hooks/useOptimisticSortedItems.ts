import { useEffect, useMemo, useState } from 'react';
import { sortItems } from '@/utils/sort';
import { ALL_NAMESPACES } from '@/constants/k8s';

export type SortOrder = 'asc' | 'desc';
export type ValueGetters<T> = Record<string, (item: T) => string | number>;

export function useOptimisticSortedItems<
  T extends { metadata?: { name?: string; namespace?: string } },
>(params: {
  items: T[];
  sortBy: string;
  sortOrder: SortOrder;
  valueGetters: ValueGetters<T>;
  selectedNamespaces?: string[];
  isNamespaced?: boolean;
  getKey?: (item: T) => string;
}) {
  const {
    items,
    sortBy,
    sortOrder,
    valueGetters,
    selectedNamespaces,
    isNamespaced = true,
    getKey,
  } = params;

  const [displayItems, setDisplayItems] = useState<T[]>(items);

  // Keep local display items in sync with source items
  useEffect(() => {
    setDisplayItems(items);
  }, [items]);

  const sortedItems = useMemo(
    () => sortItems(displayItems, sortBy, sortOrder, valueGetters),
    [displayItems, sortBy, sortOrder, valueGetters]
  );

  const defaultGetKey = (item: T) => {
    const ns = item.metadata?.namespace || '';
    const name = item.metadata?.name || '';
    return isNamespaced ? `${ns}/${name}` : name;
  };

  const shouldIncludeCreated = (created: T) => {
    if (!isNamespaced) return true;
    const createdNs = created.metadata?.namespace || '';
    if (!selectedNamespaces || selectedNamespaces.length === 0) return true;
    if (selectedNamespaces.includes(ALL_NAMESPACES)) return true;
    return selectedNamespaces.includes(createdNs);
  };

  const onAfterCreate = (created: T) => {
    if (!shouldIncludeCreated(created)) return;
    const keyOf = getKey || defaultGetKey;
    const createdKey = keyOf(created);
    setDisplayItems((prev) =>
      prev.some((item) => keyOf(item) === createdKey) ? prev : [created, ...prev]
    );
  };

  return { sortedItems, displayItems, setDisplayItems, onAfterCreate } as const;
}
