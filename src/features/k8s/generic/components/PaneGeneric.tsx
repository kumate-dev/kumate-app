import { ReactNode, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { V1Namespace } from '@kubernetes/client-node';
import { PaneTaskbar } from '@/features/k8s/generic/components/PaneTaskbar';
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
  items: T[];
  loading: boolean;
  error?: string | null;
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  columns: ColumnDef<string>[];
  renderRow: (item: T) => ReactNode;
  emptyText?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  setSortBy?: React.Dispatch<React.SetStateAction<string>>;
  setSortOrder?: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  onDelete?: (items: T[]) => Promise<void>;
  onCreate?: (manifest: T) => Promise<T | undefined>;
  onUpdate?: (manifest: T) => Promise<T | undefined>;
  yamlTemplate?: (defaultNamespace?: string) => T;
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
  creating?: boolean;
  deleting?: boolean;
}

export function PaneGeneric<T>({
  items,
  loading,
  error,
  namespaceList = [],
  selectedNamespaces = [],
  onSelectNamespace,
  columns,
  renderRow,
  emptyText = 'No items',
  sortBy,
  sortOrder,
  setSortBy,
  setSortOrder,
  onDelete,
  onCreate,
  onUpdate,
  yamlTemplate,
  showNamespace = true,
  colSpan,
  renderSidebar,
  contextName,
  creating = false,
  deleting = false,
}: PaneResourceProps<T>) {
  const [q, setQ] = useState('');
  const [selectedItems, setSelectedItems] = useState<T[]>([]);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorYaml, setEditorYaml] = useState('');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleWheelCapture = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const canScroll = el.scrollHeight > el.clientHeight;

    if (!canScroll) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    const delta = e.deltaY;
    const atTop = el.scrollTop <= 0;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

    if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const totalColSpan = useMemo(() => (colSpan || columns.length) + 1, [colSpan, columns.length]);

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

  const handleDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) return;
    setOpenDeleteModal(true);
  }, [selectedItems.length]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;

    await onDelete?.(selectedItems);
    setSelectedItems([]);
    setSelectedItem(null);
    setOpenDeleteModal(false);
  }, [selectedItems, onDelete]);

  const handleDeleteOne = useCallback(
    async (item: T) => {
      await onDelete?.([item]);
      setSelectedItem(null);
    },
    [onDelete]
  );

  const getDefaultNamespace = useCallback((): string | undefined => {
    if (!selectedNamespaces?.length) return undefined;

    const firstNamespace = selectedNamespaces[0];
    return firstNamespace === ALL_NAMESPACES ? undefined : firstNamespace;
  }, [selectedNamespaces]);

  const openCreateEditor = useCallback(() => {
    if (!yamlTemplate) return;

    const template = yamlTemplate(getDefaultNamespace());
    const resourceKind = (template as any)?.kind || 'Resource';

    setEditorTitle(`Create ${resourceKind}`);
    setEditorYaml(template ? stringify(template) : '');
    setEditorMode('create');
    setEditorOpen(true);
  }, [yamlTemplate, getDefaultNamespace]);

  const openEditEditor = useCallback(
    (item: T) => {
      const itemName = (item as any).metadata?.name ?? '';
      const resourceLabel = columns[0]?.label || 'Resource';

      setEditorTitle(`Edit ${resourceLabel}: ${itemName}`);
      setEditorYaml(stringify(item));
      setEditorMode('edit');
      setEditorOpen(true);
    },
    [columns]
  );

  const handleYamlSave = useCallback(
    async (manifest: any) => {
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
    },
    [contextName, editorMode, onCreate, onUpdate]
  );

  const handleRowClick = useCallback((item: T) => {
    setSelectedItem(item);
  }, []);

  const tableHeader = useMemo(
    () => (
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
    ),
    [columns, sortBy, sortOrder, setSortBy, setSortOrder, toggleAll, selectedItems, items]
  );

  const yamlEditorProps: YamlEditorProps = useMemo(
    () => ({
      open: editorOpen,
      title: editorTitle,
      mode: editorMode,
      initialYaml: editorYaml,
      onClose: () => setEditorOpen(false),
      onSave: handleYamlSave,
    }),
    [editorOpen, editorTitle, editorMode, editorYaml, handleYamlSave]
  );

  const hasSelectedItems = selectedItems.length > 0;

  const renderTableRows = useMemo(() => {
    if (showSkeleton) {
      return Array.from({ length: 6 }).map((_, index) => (
        <Tr key={`skeleton-${index}`}>
          <Td className="w-[1%] px-0">
            <Skeleton className="h-5 w-5 rounded" />
          </Td>
          {Array.from({ length: colSpan || columns.length }).map((_, colIndex) => (
            <Td key={colIndex}>
              <Skeleton className="h-4 w-[80%] rounded" />
            </Td>
          ))}
        </Tr>
      ));
    }

    if (!loading && items.length === 0) {
      return (
        <Tr className="text-center">
          <Td colSpan={totalColSpan} className="absolute w-full py-4 text-center text-white/60">
            {emptyText}
          </Td>
        </Tr>
      );
    }

    return items.map((item) => {
      const metadata = (item as any).metadata ?? {};
      const uid = metadata.uid ?? metadata.name ?? items.indexOf(item);

      return (
        <Tr
          key={uid}
          className="cursor-pointer hover:bg-white/5"
          onClick={() => handleRowClick(item)}
        >
          <Td className="w-[1%] px-0 whitespace-nowrap">
            <Checkbox
              checked={selectedItems.includes(item)}
              onCheckedChange={() => toggleItem(item)}
              onClick={(e) => e.stopPropagation()}
            />
          </Td>
          {renderRow(item)}
        </Tr>
      );
    });
  }, [
    showSkeleton,
    loading,
    items,
    emptyText,
    totalColSpan,
    colSpan,
    columns.length,
    handleRowClick,
    selectedItems,
    toggleItem,
    renderRow,
  ]);

  return (
    <div className="flex h-full flex-col space-y-3">
      <PaneTaskbar
        namespaceList={namespaceList}
        selectedNamespaces={selectedNamespaces}
        onSelectNamespace={onSelectNamespace}
        query={q}
        onQueryChange={setQ}
        showNamespace={showNamespace}
        selectedCount={selectedItems.length}
        onCreate={yamlTemplate ? openCreateEditor : undefined}
        onDelete={onDelete && hasSelectedItems ? handleDeleteClick : undefined}
        creating={creating}
        deleting={deleting}
      />

      {error && <ErrorMessage message={error} />}

      <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <div className="flex h-full">
          <div
            ref={scrollAreaRef}
            className="flex-1 overflow-auto overscroll-none"
            onWheelCapture={handleWheelCapture}
          >
            <div className="min-w-max">
              <Table>
                {tableHeader}
                <Tbody>{renderTableRows}</Tbody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <ModalConfirmDelete
        open={openDeleteModal}
        setOpen={setOpenDeleteModal}
        items={selectedItems}
        onConfirm={handleDeleteSelected}
      />

      <BottomYamlEditor {...yamlEditorProps} />

      {selectedItem &&
        renderSidebar &&
        renderSidebar(selectedItem, {
          setItem: setSelectedItem,
          onDelete: onDelete ? handleDeleteOne : undefined,
          onEdit: openEditEditor,
        })}
    </div>
  );
}
