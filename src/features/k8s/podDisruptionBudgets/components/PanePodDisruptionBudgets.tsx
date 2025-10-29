import { useState, useCallback } from 'react';
import { Td } from '@/components/ui/table';
import { PaneResource, PaneResourceContextProps } from '../../common/components/PaneGeneric';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listPodDisruptionBudgets,
  watchPodDisruptionBudgets,
  deletePodDisruptionBudgets,
} from '@/api/k8s/podDisruptionBudgets';
import { V1PodDisruptionBudget } from '@kubernetes/client-node';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { BadgeVariant } from '@/types/variant';
import { Badge } from '@/components/ui/badge';

export default function PanePodDisruptionBudgets({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1PodDisruptionBudget>(
    listPodDisruptionBudgets,
    watchPodDisruptionBudgets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1PodDisruptionBudget>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedPDBs, setSelectedPDBs] = useState<V1PodDisruptionBudget[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1PodDisruptionBudget>(
    deletePodDisruptionBudgets,
    context
  );

  const togglePDB = useCallback((pdb: V1PodDisruptionBudget) => {
    setSelectedPDBs((prev) =>
      prev.includes(pdb) ? prev.filter((p) => p !== pdb) : [...prev, pdb]
    );
  }, []);

  const toggleAllPDBs = useCallback(
    (checked: boolean) => {
      setSelectedPDBs(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedPDBs.length) return toast.error('No PodDisruptionBudgets selected');
    await handleDeleteResources(selectedPDBs);
    setSelectedPDBs([]);
  }, [selectedPDBs, handleDeleteResources]);

  const statusVariant = (status?: string): BadgeVariant => {
    switch (status) {
      case 'Healthy':
        return 'success';
      case 'Degraded':
        return 'warning';
      case 'Blocked':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: ColumnDef<keyof V1PodDisruptionBudget | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Min Available', key: 'spec' },
    { label: 'Max Unavailable', key: 'spec' },
    { label: 'Current Healthy', key: 'status' },
    { label: 'Desired Healthy', key: 'status' },
    { label: 'Disruptions Allowed', key: 'status' },
    { label: 'Status', key: 'status' },
    { label: 'Age', key: 'metadata' },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAllPDBs}
      selectedItems={selectedPDBs}
      totalItems={filtered}
    />
  );

  const renderRow = (pdb: V1PodDisruptionBudget) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={pdb.metadata?.name}>
          {pdb.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={pdb.metadata?.namespace ?? ''} />
      </Td>
      <Td>{pdb.spec?.minAvailable ?? '-'}</Td>
      <Td>{pdb.spec?.maxUnavailable ?? '-'}</Td>
      <Td>{pdb.status?.currentHealthy ?? '-'}</Td>
      <Td>{pdb.status?.desiredHealthy ?? '-'}</Td>
      <Td>{pdb.status?.disruptionsAllowed ?? '-'}</Td>
      <Td>
        <Badge variant={statusVariant(pdb.status?.conditions?.[0]?.type)}>
          {pdb.status?.conditions?.[0]?.type ?? '-'}
        </Badge>
      </Td>
      <AgeCell timestamp={pdb.metadata?.creationTimestamp ?? ''} />
      <Td>
        <button className="text-white/60 hover:text-white/80">⋮</button>
      </Td>
    </>
  );

  return (
    <PaneResource
      items={filtered}
      loading={loading}
      error={error ?? ''}
      query={q}
      onQueryChange={setQ}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      selectedItems={selectedPDBs}
      onToggleItem={togglePDB}
      onToggleAll={toggleAllPDBs}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
