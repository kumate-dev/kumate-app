import { Th } from '@/components/ui/table';
import { ChevronUp, ChevronDown } from 'lucide-react';
import React from 'react';

export type SortKey = string;

export interface ColumnDef<SortKey extends string> {
  label: string;
  key: SortKey;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string; // optional column width (e.g. w-[200px], w-1/5)
}

interface TableHeaderProps<SortKey extends string> {
  columns: ColumnDef<SortKey | 'empty'>[];
  sortBy: SortKey;
  sortOrder: 'asc' | 'desc';
  setSortBy: React.Dispatch<React.SetStateAction<SortKey>>;
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
}

export const TableHeader = <SortKey extends string>({
  columns,
  sortBy,
  sortOrder,
  setSortBy,
  setSortOrder,
}: TableHeaderProps<SortKey>) => {
  const handleSort = (column: SortKey | 'empty', sortable?: boolean) => {
    if (!sortable || column === 'empty') return;
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <thead className="sticky top-0 z-10 bg-neutral-900">
      <tr>
        {columns.map(({ label, key, sortable = true, align = 'left', width }) => {
          const isActive = sortBy === key;
          const alignClass =
            align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

          return (
            <Th key={key} className={`${alignClass} ${width || ''} select-none`}>
              {sortable && key !== 'empty' ? (
                <button
                  className="group inline-flex items-center gap-1 font-medium"
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
                <span className="font-medium">{label}</span>
              )}
            </Th>
          );
        })}
      </tr>
    </thead>
  );
};
