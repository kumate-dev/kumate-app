import { Th } from '../ui';
import { ChevronUp, ChevronDown } from 'lucide-react';

export type SortKey = string;

export interface ColumnDef<SortKey extends string> {
  label: string;
  key: SortKey;
  sortable?: boolean;
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
    <thead>
      <tr>
        {columns.map(({ label, key, sortable = true }) => {
          const isActive = sortBy === key;
          return (
            <Th key={key}>
              {sortable && key !== 'empty' ? (
                <button
                  className="inline-flex items-center gap-1 font-medium text-left"
                  onClick={() => handleSort(key, sortable)}
                >
                  <span>{label}</span>
                  {isActive &&
                    (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </button>
              ) : (
                <span className="font-medium text-left">{label}</span>
              )}
            </Th>
          );
        })}
      </tr>
    </thead>
  );
};
