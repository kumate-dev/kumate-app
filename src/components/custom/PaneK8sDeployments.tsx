import { useState, useCallback } from 'react';
import { PaneK8sResource } from './PaneK8sResource';
import { SidebarK8sDeployment } from './SidebarK8sDeployment';
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
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { readyVariant } from '@/utils/k8s';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { k8sDeploymentStatusVariant } from '@/constants/variant';

export default function PaneK8sDeployments({ context }: { context?: any }) {
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
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentItem | null>(null);

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

  const handleDeleteOne = async (item: DeploymentItem) => {
    await handleDeleteResources([item]);
    setSelectedDeployment(null);
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
      onRowClick={(f) => setSelectedDeployment(f)}
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
            <Badge variant={k8sDeploymentStatusVariant(f.status || '')}>{f.status || ''}</Badge>
          </Td>
          <Td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </Td>
          {selectedDeployment && (
            <SidebarK8sDeployment
              item={selectedDeployment}
              setItem={setSelectedDeployment}
              onDelete={handleDeleteOne}
            />
          )}
        </>
      )}
    />
  );
}
