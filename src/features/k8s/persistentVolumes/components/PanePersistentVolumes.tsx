import { useCallback, useMemo, useState } from 'react';
import type { V1PersistentVolume } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { sortItems } from '@/utils/sort';
import { SidebarPersistentVolumes } from './SidebarPersistentVolumes';
import { templatePersistentVolume } from '../../templates/persistentVolume';

export interface PanePersistentVolumesProps {
  items: V1PersistentVolume[];
  loading: boolean;
  error: string;
  onDelete: (items: V1PersistentVolume[]) => Promise<void>;
  onCreate?: (manifest: V1PersistentVolume) => Promise<V1PersistentVolume | undefined>;
  onUpdate?: (manifest: V1PersistentVolume) => Promise<V1PersistentVolume | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PanePersistentVolumes({
  items,
  loading,
  error,
  onDelete,
  onCreate,
  onUpdate,
  contextName,
  creating = false,
  updating = false,
  deleting = false,
}: PanePersistentVolumesProps) {
  const [sortBy, setSortBy] = useState('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = useMemo(
    () => [
      { key: 'Name', label: 'Name', sortable: true },
      { key: 'StorageClass', label: 'Storage Class', sortable: true },
      { key: 'Capacity', label: 'Capacity', sortable: true },
      { key: 'AccessModes', label: 'Access Modes', sortable: true },
      { key: 'ReclaimPolicy', label: 'Reclaim Policy', sortable: true },
      { key: 'Phase', label: 'Phase', sortable: true },
      { key: 'Age', label: 'Age', sortable: true },
    ],
    []
  );

  const sortedItems = useMemo(() => {
    const valueGetters = {
      Name: (item: V1PersistentVolume) => item.metadata?.name ?? '',
      StorageClass: (item: V1PersistentVolume) => item.spec?.storageClassName ?? '',
      Capacity: (item: V1PersistentVolume) => (item.spec?.capacity as any)?.storage || '',
      AccessModes: (item: V1PersistentVolume) => (item.spec?.accessModes || []).join(', '),
      ReclaimPolicy: (item: V1PersistentVolume) => item.spec?.persistentVolumeReclaimPolicy ?? '',
      Phase: (item: V1PersistentVolume) => item.status?.phase ?? '',
      Age: (item: V1PersistentVolume) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const handleDeleteSelected = useCallback(
    async (items: V1PersistentVolume[]) => {
      await onDelete(items);
    },
    [onDelete]
  );

  const renderRow = (pv: V1PersistentVolume) => (
    <>
      <Td className="break-all text-white">{pv.metadata?.name ?? '-'}</Td>
      <Td className="break-all text-white">{pv.spec?.storageClassName ?? '-'}</Td>
      <Td className="break-all text-white">{(pv.spec?.capacity as any)?.storage || '-'}</Td>
      <Td className="break-all text-white">{(pv.spec?.accessModes || []).join(', ') || '-'}</Td>
      <Td className="break-all text-white">{pv.spec?.persistentVolumeReclaimPolicy ?? '-'}</Td>
      <Td className="break-all text-white">{pv.status?.phase ?? '-'}</Td>
      <AgeCell timestamp={pv.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1PersistentVolume,
      actions: {
        setItem: (item: V1PersistentVolume | null) => void;
        onDelete?: (item: V1PersistentVolume) => void;
        onEdit?: (item: V1PersistentVolume) => void;
      }
    ) => (
      <SidebarPersistentVolumes
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
      onDelete={handleDeleteSelected}
      renderSidebar={renderSidebar}
      yamlTemplate={templatePersistentVolume}
      onCreate={onCreate}
      onUpdate={onUpdate}
      creating={creating}
      deleting={deleting}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
    />
  );
}
