import { ReactNode } from 'react';
import { PaneTaskbar } from './PaneTaskbar';
import { PaneSearch } from './PaneSearch';
import { Table, Tbody, Td, Tr, Th, Thead } from '@/components/ui/table';
import { ErrorMessage } from './ErrorMessage';
import React from 'react';
import { K8sContext } from '@/services/contexts';
import { Checkbox } from '../ui/checkbox';

export interface PaneK8sResourceContextProps {
  context?: K8sContext | null;
}

interface PaneK8sResourceProps<T> {
  items: T[];
  loading: boolean;
  error?: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  namespaceList?: { name: string }[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  showNamespace?: boolean;
  selectedItems?: T[];
  onToggleItem?: (item: T) => void;
  onToggleAll?: (checked: boolean) => void;
  onDeleteSelected?: () => void;
  renderRow: (item: T) => ReactNode;
  emptyText?: string;
  colSpan?: number;
  tableHeader?: ReactNode;
}

export function PaneK8sResource<T>({
  items,
  loading,
  error,
  query,
  onQueryChange,
  namespaceList = [],
  selectedNamespaces = [],
  onSelectNamespace,
  showNamespace = true,
  selectedItems = [],
  onToggleItem,
  onDeleteSelected,
  renderRow,
  emptyText = 'No items',
  colSpan = 5,
  tableHeader,
}: PaneK8sResourceProps<T>) {
  const totalItems = items;

  const totalColSpan = (colSpan || 0) + (onToggleItem ? 1 : 0);

  return (
    <div className="flex h-full flex-col space-y-3">
      {(showNamespace && onSelectNamespace) || !showNamespace ? (
        <PaneTaskbar
          namespaceList={namespaceList}
          selectedNamespaces={selectedNamespaces}
          onSelectNamespace={onSelectNamespace!}
          query={query}
          onQueryChange={onQueryChange}
          showNamespace={showNamespace}
          selectedCount={selectedItems.length}
          onDeleteSelected={onDeleteSelected}
        />
      ) : (
        <div className="mb-4">
          <PaneSearch query={query} onQueryChange={onQueryChange} />
        </div>
      )}

      {error && <ErrorMessage message={error || ''} />}

      <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <div className="h-full overflow-auto">
          <div className="min-w-max">
            <Table>
              {tableHeader}
              <Tbody>
                {loading && (
                  <Tr className="text-center">
                    <Td colSpan={totalColSpan} className="py-4 text-white/60">
                      Loading…
                    </Td>
                  </Tr>
                )}

                {!loading && items.length === 0 && (
                  <Tr className="text-center">
                    <Td colSpan={totalColSpan} className="py-4 text-white/60">
                      {emptyText}
                    </Td>
                  </Tr>
                )}

                {!loading &&
                  items.map((item, idx) => (
                    <Tr key={idx}>
                      {onToggleItem && (
                        <Td>
                          <Checkbox
                            checked={selectedItems.includes(item)}
                            onCheckedChange={() => onToggleItem(item)}
                          />
                        </Td>
                      )}
                      {renderRow(item)}
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
