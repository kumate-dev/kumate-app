export function sortItems<T>(
  items: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  valueGetters: Record<string, (item: T) => any>,
  collatorOptions: Intl.CollatorOptions = { sensitivity: 'base', numeric: true }
): T[] {
  if (!items.length) return [];

  const collator = new Intl.Collator('en', collatorOptions);
  const getValue = valueGetters[sortBy] || (() => '');

  const sorted = [...items].sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);

    const isNumeric = typeof aValue === 'number' && typeof bValue === 'number';

    if (isNumeric) {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      const strA = String(aValue || '');
      const strB = String(bValue || '');
      const comparison = collator.compare(strA, strB);
      return sortOrder === 'asc' ? comparison : -comparison;
    }
  });

  return sorted;
}
