import { useState, useCallback } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listDeployments,
  watchDeployments,
  DeploymentItem,
  deleteDeployments,
} from '@/services/deployments';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { BadgeVariant } from '@/types/variant';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { readyVariant } from '@/utils/k8s';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';

export default function PaneK8sDeployments({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<DeploymentItem>(
    listDeployments,
    watchDeployments,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof DeploymentItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDeployments, setSelectedDeployments] = useState<DeploymentItem[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  const toggleDeployment = useCallback((dep: DeploymentItem) => {
    setSelectedDeployments((prev) =>
      prev.includes(dep) ? prev.filter((d) => d !== dep) : [...prev, dep]
    );
  }, []);

  const toggleAllDeployments = useCallback(
    (checked: boolean) => {
      setSelectedDeployments(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const { handleDeleteResources } = useDeleteK8sResources<DeploymentItem>(
    deleteDeployments,
    context
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedDeployments.length === 0) return toast.error('No deployments selected');
    await handleDeleteResources(selectedDeployments);
    setSelectedDeployments([]);
  }, [selectedDeployments, handleDeleteResources]);

  const statusVariant = (s: string): BadgeVariant => {
    switch (s) {
      case 'Available':
        return 'success';
      case 'Progressing':
      case 'Scaling':
        return 'warning';
      case 'Terminating':
        return 'secondary';
      case 'Failed':
      case 'Unavailable':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: ColumnDef<keyof DeploymentItem | ''>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Ready', key: 'ready' },
    { label: 'Age', key: 'creation_timestamp' },
    { label: 'Status', key: 'status' },
    { label: '', key: '', sortable: false },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAllDeployments}
      selectedItems={selectedDeployments}
      totalItems={filtered}
    />
  );

  return (
    <PaneK8sResource
      items={filtered}
      loading={loading}
      error={error ?? ''}
      query={q}
      onQueryChange={setQ}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      selectedItems={selectedDeployments}
      onToggleItem={toggleDeployment}
      onToggleAll={toggleAllDeployments}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={(f) => (
        <>
          <Td className="max-w-truncate align-middle">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </Td>
          <Td>
            <BadgeK8sNamespaces name={f.namespace} />
          </Td>
          <Td>
            <Badge variant={readyVariant(f.ready)}>{f.ready}</Badge>
          </Td>
          <AgeCell timestamp={f.creation_timestamp || ''} />
          <Td>
            <Badge variant={statusVariant(f.status || '')}>{f.status || ''}</Badge>
          </Td>
          <Td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </Td>
        </>
      )}
    />
  );
}
