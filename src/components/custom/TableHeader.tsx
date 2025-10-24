import { Th } from '@/components/ui/table';
import { ChevronUp, ChevronDown } from 'lucide-react';
import React from 'react';
import { Checkbox } from '../ui/checkbox';

export type SortKey = string;

export interface ColumnDef<SortKey extends string> {
  label: string;
  key: SortKey;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string; // optional column width
}

interface TableHeaderProps<SortKey extends string> {
  columns: ColumnDef<SortKey | ''>[];
  sortBy: SortKey;
  sortOrder: 'asc' | 'desc';
  setSortBy: React.Dispatch<React.SetStateAction<SortKey>>;
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  onToggleAll?: (checked: boolean) => void;
  selectedItems?: any[];
  totalItems?: any[];
}

export const TableHeader = <SortKey extends string>({
  columns,
  sortBy,
  sortOrder,
  setSortBy,
  setSortOrder,
  onToggleAll,
  selectedItems = [],
  totalItems = [],
}: TableHeaderProps<SortKey>) => {
  const handleSort = (column: SortKey | '', sortable?: boolean) => {
    if (!sortable || column === '') return;
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const allSelected = totalItems.length > 0 && selectedItems.length === totalItems.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < totalItems.length;

  return (
    <thead className="sticky top-0 z-10 bg-neutral-900">
      <tr className="align-middle">
        {onToggleAll && (
          <Th className="w-12 text-center align-middle">
            <Checkbox
              checked={allSelected}
              indeterminate={isIndeterminate}
              onCheckedChange={(checked) => onToggleAll(checked)}
            />
          </Th>
        )}

        {columns.map(({ label, key, sortable = true, align = 'left', width }) => {
          const isActive = sortBy === key;
          const alignClass =
            align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

          return (
            <Th key={key} className={`${alignClass} align-middle ${width || ''} select-none`}>
              {sortable && key !== '' ? (
                <button
                  className="group inline-flex w-full items-center justify-start gap-1 font-medium"
                  onClick={() => handleSort(key, sortable)}
                >
                  <span className="truncate">{label}</span>
                  <span className="inline-flex h-3 w-3 items-center justify-center">
                    {isActive ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="h-3 w-3 transition-transform duration-150 group-hover:scale-110" />
                      ) : (
                        <ChevronDown className="h-3 w-3 transition-transform duration-150 group-hover:scale-110" />
                      )
                    ) : (
                      <span className="block h-3 w-3" />
                    )}
                  </span>
                </button>
              ) : (
                <span className="block truncate font-medium">{label}</span>
              )}
            </Th>
          );
        })}
      </tr>
    </thead>
  );
};
