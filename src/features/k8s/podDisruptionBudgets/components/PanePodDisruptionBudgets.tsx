import { useState, useCallback } from 'react';
import { V1PodDisruptionBudget, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeVariant } from '@/types/variant';
import { Badge } from '@/components/ui/badge';
import { K8sStatus } from '@/types/k8sStatus';
import { getPodDisruptionBudgetsStatus } from '../utils/podDisruptionBudgetsStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';

export interface PanePodDisruptionBudgetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1PodDisruptionBudget[];
  loading: boolean;
  error: string;
  onDeletePodDisruptionBudgets: (pdbs: V1PodDisruptionBudget[]) => Promise<void>;
}

export default function PanePodDisruptionBudgets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeletePodDisruptionBudgets,
}: PanePodDisruptionBudgetsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1PodDisruptionBudget>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1PodDisruptionBudget[]>([]);

  const toggleItem = useCallback((pdb: V1PodDisruptionBudget) => {
    setSelectedItems((prev) =>
      prev.includes(pdb) ? prev.filter((p) => p !== pdb) : [...prev, pdb]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeletePodDisruptionBudgets(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeletePodDisruptionBudgets]);

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
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const renderRow = (pdb: V1PodDisruptionBudget) => {
    return (
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
          <BadgeStatus status={getPodDisruptionBudgetsStatus(pdb)} />
        </Td>
        <AgeCell timestamp={pdb.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  return (
    <PaneGeneric
      items={items}
      loading={loading}
      error={error}
      query={q}
      onQueryChange={setQ}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      selectedItems={selectedItems}
      onToggleItem={toggleItem}
      onDelete={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
