import { ReactNode } from 'react';
import { PaneTaskbar } from './PaneTaskbar';
import { PaneSearch } from './PaneSearch';
import { Table, Tbody } from '@/components/ui/table';
import { ErrorMessage } from './ErrorMessage';

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
  renderRow,
  emptyText = 'No items',
  colSpan = 5,
  tableHeader,
}: PaneK8sResourceProps<T>) {
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
                  <tr>
                    <td colSpan={colSpan} className="text-white/60">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="text-white/60">
                      {emptyText}
                    </td>
                  </tr>
                )}
                {!loading && items.map((item) => renderRow(item))}
              </Tbody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
