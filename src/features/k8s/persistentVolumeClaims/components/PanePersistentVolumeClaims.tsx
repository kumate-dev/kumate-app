import { useState, useCallback, useMemo } from 'react';
import { V1PersistentVolumeClaim, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { templatePersistentVolumeClaim } from '../../templates/persistentVolumeClaim';
import { BadgeVariant } from '@/types/variant';
import { K8sStatus } from '@/types/k8sStatus';
import { SidebarPersistentVolumeClaims } from './SidebarPersistentVolumeClaims';
import { useOptimisticSortedItems } from '@/hooks/useOptimisticSortedItems';

export interface PanePersistentVolumeClaimsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1PersistentVolumeClaim[];
  loading: boolean;
  error: string;
  onDeletePersistentVolumeClaims: (pvcs: V1PersistentVolumeClaim[]) => Promise<void>;
  onCreate?: (manifest: V1PersistentVolumeClaim) => Promise<V1PersistentVolumeClaim | undefined>;
  onUpdate?: (manifest: V1PersistentVolumeClaim) => Promise<V1PersistentVolumeClaim | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

const getPvcStatus = (pvc: V1PersistentVolumeClaim): K8sStatus => {
  const phase = pvc.status?.phase ?? 'Unknown';
  let variant: BadgeVariant = 'default';
  switch (phase) {
    case 'Bound':
      variant = 'success';
      break;
    case 'Pending':
      variant = 'warning';
      break;
    case 'Lost':
      variant = 'error';
      break;
    case 'Released':
      variant = 'warning';
      break;
    default:
      variant = 'default';
  }
  return { status: phase, variant };
};

export default function PanePersistentVolumeClaims({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeletePersistentVolumeClaims,
  onCreate,
  onUpdate,
  contextName,
  creating = false,
  updating = false,
  deleting = false,
}: PanePersistentVolumeClaimsProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const valueGetters = useMemo(
    () => ({
      name: (item: V1PersistentVolumeClaim) => item.metadata?.name || '',
      namespace: (item: V1PersistentVolumeClaim) => item.metadata?.namespace || '',
      status: (item: V1PersistentVolumeClaim) => item.status?.phase || '',
      storageClass: (item: V1PersistentVolumeClaim) => item.spec?.storageClassName || '',
      capacity: (item: V1PersistentVolumeClaim) => (item.status?.capacity as any)?.storage || '',
      accessModes: (item: V1PersistentVolumeClaim) => (item.spec?.accessModes || []).join(', '),
      age: (item: V1PersistentVolumeClaim) =>
        new Date(item.metadata?.creationTimestamp || '').getTime(),
    }),
    []
  );

  const { sortedItems, onAfterCreate } = useOptimisticSortedItems<V1PersistentVolumeClaim>({
    items,
    sortBy,
    sortOrder,
    valueGetters,
    selectedNamespaces,
    isNamespaced: true,
  });

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Status', key: 'status', sortable: true },
    { label: 'Storage Class', key: 'storageClass', sortable: true },
    { label: 'Capacity', key: 'capacity', sortable: true },
    { label: 'Access Modes', key: 'accessModes', sortable: false },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const renderRow = (pvc: V1PersistentVolumeClaim) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={pvc.metadata?.name ?? ''}>
          {pvc.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={pvc.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <BadgeStatus status={getPvcStatus(pvc)} />
      </Td>
      <Td>{pvc.spec?.storageClassName || '-'}</Td>
      <Td>{(pvc.status?.capacity as any)?.storage || '-'}</Td>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={(pvc.spec?.accessModes || []).join(', ')}>
          {(pvc.spec?.accessModes || []).join(', ') || '-'}
        </span>
      </Td>
      <AgeCell timestamp={pvc.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1PersistentVolumeClaim,
      actions: {
        setItem: (item: V1PersistentVolumeClaim | null) => void;
        onDelete?: (item: V1PersistentVolumeClaim) => void;
        onEdit?: (item: V1PersistentVolumeClaim) => void;
      }
    ) => (
      <SidebarPersistentVolumeClaims
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
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onDelete={onDeletePersistentVolumeClaims}
      renderRow={renderRow}
      yamlTemplate={templatePersistentVolumeClaim}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onAfterCreate={onAfterCreate}
      renderSidebar={renderSidebar}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
