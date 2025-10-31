import { Th } from '@/components/ui/table';
import { ChevronUp, ChevronDown } from 'lucide-react';
import React from 'react';
import { Checkbox } from '../ui/checkbox';

export type SortKey = string;

export interface ColumnDef<T extends string> {
  label: string;
  key: T;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface TableHeaderProps<T extends string> {
  columns: ColumnDef<T>[];
  sortBy?: T;
  sortOrder?: 'asc' | 'desc';
  setSortBy?: React.Dispatch<React.SetStateAction<T>>;
  setSortOrder?: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  onToggleAll?: (checked: boolean) => void;
  selectedItems?: any[];
  totalItems?: any[];
}

export const TableHeader = <T extends string>({
  columns,
  sortBy,
  sortOrder,
  setSortBy,
  setSortOrder,
  onToggleAll,
  selectedItems = [],
  totalItems = [],
}: TableHeaderProps<T>) => {
  const handleSort = (column: T, sortable?: boolean) => {
    if (!sortable || !setSortBy || !setSortOrder) return;

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
    <thead className="sticky top-0 bg-neutral-900/100">
      <tr className="align-middle">
        {onToggleAll && (
          <Th className="w-[1px] px-0 text-center align-middle" style={{ width: '1px' }}>
            <Checkbox
              checked={allSelected}
              indeterminate={isIndeterminate}
              onCheckedChange={(checked) => onToggleAll(!!checked)}
            />
          </Th>
        )}

        {columns.map(({ label, key, sortable = true, align = 'left', width }) => {
          const isActive = sortBy === key;
          const alignClass =
            align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

          return (
            <Th
              key={key}
              className={`${alignClass} align-middle ${width || ''} select-none`}
              style={width ? { width } : undefined}
            >
              {sortable && setSortBy && setSortOrder ? (
                <button
                  className="group inline-flex w-full items-center justify-start gap-1 font-medium transition-colors hover:text-white"
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
                      <span className="block h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50">
                        <ChevronUp className="h-3 w-3" />
                      </span>
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
