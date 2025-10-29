import { ReactNode, useRef, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { K8sContext } from '@/api/k8s/contexts';
import { V1Namespace } from '@kubernetes/client-node';
import { PaneTaskbar } from '@/components/common/Taskbar';
import { PaneSearch } from '@/components/common/Search';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ModalConfirmDelete } from '@/components/common/ModalConfirmDelete';

export interface PaneResourceContextProps {
  context?: K8sContext | null;
}

export interface PaneResourceProps<T> {
  items: T[];
  loading: boolean;
  error?: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  showNamespace?: boolean;
  selectedItem?: T | null;
  selectedItems?: T[];
  onToggleItem?: (item: T) => void;
  onToggleAll?: (checked: boolean) => void;
  onDeleteSelected?: () => void;
  renderRow: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
  emptyText?: string;
  colSpan?: number;
  tableHeader?: ReactNode;
  renderSidebar?: (item: T, tableRef: React.RefObject<HTMLTableElement | null>) => ReactNode;
  onCloseSidebar?: () => void;
}

export function PaneResource<T>({
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
  onRowClick,
  emptyText = 'No items',
  colSpan = 5,
  tableHeader,
  selectedItem,
  renderSidebar,
}: PaneResourceProps<T>) {
  const totalColSpan = (colSpan || 0) + (onToggleItem ? 1 : 0);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setShowSkeleton(true), 250);
    } else {
      setShowSkeleton(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleDeleteClick = () => {
    if (!selectedItems || selectedItems.length === 0) return;
    setOpenDeleteModal(true);
  };

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
          selectedCount={selectedItems?.length || 0}
          onDeleteSelected={handleDeleteClick}
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
            <Table ref={tableRef}>
              {tableHeader}
              <Tbody>
                {showSkeleton &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <Tr key={`skeleton-${i}`}>
                      {onToggleItem && (
                        <Td className="w-[1%] px-0">
                          <Skeleton className="h-5 w-5 rounded" />
                        </Td>
                      )}
                      {Array.from({ length: colSpan }).map((_, j) => (
                        <Td key={j} className="py-2">
                          <Skeleton className="h-4 w-[80%] rounded" />
                        </Td>
                      ))}
                    </Tr>
                  ))}

                {!loading && items.length === 0 && (
                  <Tr className="text-center">
                    <Td colSpan={totalColSpan} className="py-4 text-white/60">
                      {emptyText}
                    </Td>
                  </Tr>
                )}

                {!loading &&
                  items.map((item) => {
                    const meta: any = (item as any).metadata ?? {};
                    const uid = meta.uid ?? meta.name ?? items.indexOf(item);

                    return (
                      <Tr
                        key={uid}
                        className={`cursor-pointer ${onRowClick ? 'hover:bg-white/5' : ''}`}
                        onClick={() => onRowClick?.(item)}
                      >
                        {onToggleItem && (
                          <Td className="w-[1%] px-0 whitespace-nowrap">
                            <Checkbox
                              checked={selectedItems?.includes(item)}
                              onCheckedChange={() => onToggleItem(item)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>
                        )}
                        {renderRow(item)}
                      </Tr>
                    );
                  })}
              </Tbody>
            </Table>
          </div>
        </div>

        {selectedItem && renderSidebar && (
          <div className="w-[550px] border-l border-white/10">
            {renderSidebar(selectedItem, tableRef)}
          </div>
        )}
      </div>

      {onDeleteSelected && (
        <ModalConfirmDelete
          open={openDeleteModal}
          setOpen={setOpenDeleteModal}
          items={selectedItems}
          onConfirm={onDeleteSelected}
        />
      )}
    </div>
  );
}
