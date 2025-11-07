import { useCallback, useMemo, useState } from 'react';
import type { V1StorageClass } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { sortItems } from '@/utils/sort';
import { SidebarStorageClasses } from './SidebarStorageClasses';
import { templateStorageClass } from '../../templates/storageClass';

export interface PaneStorageClassesProps {
  items: V1StorageClass[];
  loading: boolean;
  error: string;
  onDelete: (items: V1StorageClass[]) => Promise<void>;
  onCreate?: (manifest: V1StorageClass) => Promise<V1StorageClass | undefined>;
  onUpdate?: (manifest: V1StorageClass) => Promise<V1StorageClass | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneStorageClasses({
  items,
  loading,
  error,
  onDelete,
  onCreate,
  onUpdate,
  contextName,
  creating,
  updating,
  deleting,
}: PaneStorageClassesProps) {
  const [sortBy, setSortBy] = useState('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = useMemo(
    () => [
      { key: 'Name', label: 'Name', sortable: true },
      { key: 'Provisioner', label: 'Provisioner', sortable: true },
      { key: 'ReclaimPolicy', label: 'Reclaim Policy', sortable: true },
      { key: 'VolumeBindingMode', label: 'Binding Mode', sortable: true },
      { key: 'AllowExpansion', label: 'Allow Expansion', sortable: true },
      { key: 'Age', label: 'Age', sortable: true },
    ],
    []
  );

  const sortedItems = useMemo(() => {
    const valueGetters = {
      Name: (item: V1StorageClass) => item.metadata?.name ?? '',
      Provisioner: (item: V1StorageClass) => item.provisioner ?? '',
      ReclaimPolicy: (item: V1StorageClass) => (item as any).reclaimPolicy ?? '',
      VolumeBindingMode: (item: V1StorageClass) => item.volumeBindingMode ?? '',
      AllowExpansion: (item: V1StorageClass) => (item.allowVolumeExpansion ? 'true' : 'false'),
      Age: (item: V1StorageClass) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (sc: V1StorageClass) => (
    <>
      <Td className="break-all text-white">{sc.metadata?.name ?? '-'}</Td>
      <Td className="break-all text-white">{sc.provisioner ?? '-'}</Td>
      <Td className="break-all text-white">{(sc as any).reclaimPolicy ?? '-'}</Td>
      <Td className="break-all text-white">{sc.volumeBindingMode ?? '-'}</Td>
      <Td className="break-all text-white">{sc.allowVolumeExpansion ? 'true' : 'false'}</Td>
      <AgeCell timestamp={sc.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1StorageClass,
      actions: {
        setItem: (item: V1StorageClass | null) => void;
        onDelete?: (item: V1StorageClass) => void;
        onEdit?: (item: V1StorageClass) => void;
      }
    ) => (
      <SidebarStorageClasses
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
        updating={updating}
        deleting={deleting}
      />
    ),
    [updating, deleting]
  );

  return (
    <PaneGeneric
      items={sortedItems}
      loading={loading}
      error={error}
      showNamespace={false}
      columns={columns}
      renderRow={renderRow}
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateStorageClass}
      onCreate={onCreate}
      onUpdate={onUpdate}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
