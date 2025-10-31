import { ReactNode, useRef, useState, useEffect, useCallback } from 'react';
import { V1Namespace } from '@kubernetes/client-node';
import { PaneTaskbar } from '@/features/k8s/generic/components/PaneTaskbar';
import { Search } from '@/components/common/Search';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ModalConfirmDelete } from '@/components/common/ModalConfirmDelete';
import { Skeleton } from '@/components/ui/skeleton';
import { K8sContext } from '@/api/k8s/contexts';
import BottomYamlEditor from '@/components/common/BottomYamlEditor';
import { YamlEditorProps } from '@/types/yaml';
import { TableHeader, ColumnDef } from '@/components/common/TableHeader';
import { stringify } from 'yaml';
import { ALL_NAMESPACES } from '@/constants/k8s';

export interface PaneResourceContextProps {
  context?: K8sContext | null;
}

export interface PaneResourceProps<T> {
  // Data props
  items: T[];
  loading: boolean;
  error?: string | null;
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;

  // Table configuration
  columns: ColumnDef<string>[];
  renderRow: (item: T) => ReactNode;
  emptyText?: string;

  // Action handlers
  onDelete: (items: T[]) => Promise<void>;
  onCreate?: (manifest: T) => Promise<T | undefined>;
  onUpdate?: (manifest: T) => Promise<T | undefined>;

  // Yaml editor
  yamlTemplate?: (defaultNamespace?: string) => T;

  // Optional overrides
  showNamespace?: boolean;
  colSpan?: number;
  renderSidebar?: (
    item: T,
    actions: {
      setItem: (item: T | null) => void;
      onDelete?: (item: T) => void;
      onEdit?: (item: T) => void;
    }
  ) => ReactNode;
  contextName?: string;
}

export function PaneGeneric<T>({
  // Data props
  items,
  loading,
  error,
  namespaceList = [],
  selectedNamespaces = [],
  onSelectNamespace,

  // Table configuration
  columns,
  renderRow,
  emptyText = 'No items',

  // Action handlers
  onDelete,
  onCreate,
  onUpdate,

  // Yaml editor
  yamlTemplate,

  // Optional overrides
  showNamespace = true,
  colSpan,
  renderSidebar,
  contextName,
}: PaneResourceProps<T>) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<T[]>([]);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState<string>('');
  const [editorYaml, setEditorYaml] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');

  const totalColSpan = (colSpan || columns.length) + 1;
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setShowSkeleton(true), 250);
    } else {
      setShowSkeleton(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const toggleItem = useCallback((item: T) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteClick = () => {
    if (selectedItems.length === 0) return;
    setOpenDeleteModal(true);
  };

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    await onDelete(selectedItems);
    setSelectedItems([]);
    setSelectedItem(null);
    setOpenDeleteModal(false);
  }, [selectedItems, onDelete]);

  const handleDeleteOne = async (item: T) => {
    await onDelete([item]);
    setSelectedItem(null);
  };

  const getDefaultNamespace = useCallback(() => {
    if (!selectedNamespaces || selectedNamespaces.length === 0) return undefined;
    const ns = selectedNamespaces[0];
    return ns === ALL_NAMESPACES ? undefined : ns;
  }, [selectedNamespaces]);

  const openCreateEditor = useCallback(() => {
    if (!yamlTemplate) return;

    const template = yamlTemplate(getDefaultNamespace());
    setEditorTitle(`Create ${(template as any)?.kind || 'Resource'}`);
    setEditorYaml(template ? stringify(template) : '');
    setEditorMode('create');
    setEditorOpen(true);
  }, [yamlTemplate, getDefaultNamespace]);

  const openEditEditor = useCallback(
    (item: T) => {
      const itemName = (item as any).metadata?.name ?? '';
      setEditorTitle(`Edit ${columns[0]?.label || 'Resource'}: ${itemName}`);
      setEditorYaml(stringify(item));
      setEditorMode('edit');
      setEditorOpen(true);
    },
    [columns]
  );

  const handleYamlSave = async (manifest: any) => {
    if (!contextName) {
      throw new Error('Missing context name.');
    }

    try {
      if (editorMode === 'create') {
        await onCreate?.(manifest);
      } else {
        await onUpdate?.(manifest);
      }
      setEditorOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const handleRowClick = useCallback((item: T) => {
    setSelectedItem(item);
  }, []);

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const yamlEditorProps: YamlEditorProps = {
    open: editorOpen,
    title: editorTitle,
    mode: editorMode,
    initialYaml: editorYaml,
    onClose: () => setEditorOpen(false),
    onSave: handleYamlSave,
  };

  return (
    <div className="flex h-full flex-col space-y-3">
      {(showNamespace && onSelectNamespace) || !showNamespace ? (
        <PaneTaskbar
          namespaceList={namespaceList}
          selectedNamespaces={selectedNamespaces}
          onSelectNamespace={onSelectNamespace!}
          query={q}
          onQueryChange={setQ}
          showNamespace={showNamespace}
          selectedCount={selectedItems?.length || 0}
          onCreate={yamlTemplate ? openCreateEditor : undefined}
          onDelete={handleDeleteClick}
        />
      ) : (
        <div className="mb-4">
          <Search query={q} onQueryChange={setQ} />
        </div>
      )}

      {error && <ErrorMessage message={error || ''} />}

      <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <div className="h-full overflow-auto">
          <div className="min-w-max">
            <Table>
              {tableHeader}
              <Tbody>
                {showSkeleton &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <Tr key={`skeleton-${i}`}>
                      <Td className="w-[1%] px-0">
                        <Skeleton className="h-5 w-5 rounded" />
                      </Td>
                      {Array.from({ length: colSpan || columns.length }).map((_, j) => (
                        <Td key={j} className="py-2">
                          <Skeleton className="h-4 w-[80%] rounded" />
                        </Td>
                      ))}
                    </Tr>
                  ))}

                {!loading && items.length === 0 && (
                  <Tr className="text-center">
                    <Td
                      colSpan={totalColSpan}
                      className="absolute w-full py-4 text-center text-white/60"
                    >
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
                        className="cursor-pointer hover:bg-white/5"
                        onClick={() => handleRowClick(item)}
                      >
                        <Td className="w-[1%] px-0 whitespace-nowrap">
                          <Checkbox
                            checked={selectedItems?.includes(item)}
                            onCheckedChange={() => toggleItem(item)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Td>
                        {renderRow(item)}
                      </Tr>
                    );
                  })}
              </Tbody>
            </Table>
          </div>
        </div>

        {selectedItem && renderSidebar && (
          <div className="w-[550px]">
            {renderSidebar(selectedItem, {
              setItem: setSelectedItem,
              onDelete: handleDeleteOne,
              onEdit: openEditEditor,
            })}
          </div>
        )}
      </div>

      <ModalConfirmDelete
        open={openDeleteModal}
        setOpen={setOpenDeleteModal}
        items={selectedItems}
        onConfirm={handleDeleteSelected}
      />

      <BottomYamlEditor {...yamlEditorProps} />
    </div>
  );
}
