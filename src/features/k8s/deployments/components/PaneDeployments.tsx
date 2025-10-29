import { useState, useCallback, RefObject } from 'react';
import { V1Deployment } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listDeployments, watchDeployments, deleteDeployments } from '@/api/k8s/deployments';
import { Td } from '@/components/ui/table';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { SidebarK8sDeployments } from './SidebarDeployments';
import { PaneResource, PaneResourceContextProps } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeDeploymentStatus } from './BadgeDeploymentStatus';

export default function PaneDeployments({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Deployment>(
    listDeployments,
    watchDeployments,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Deployment>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDeployments, setSelectedDeployments] = useState<V1Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<V1Deployment | null>(null);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    'metadata.name',
    'asc'
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1Deployment>(deleteDeployments, context);

  const toggleDeployment = useCallback((dep: V1Deployment) => {
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

  const handleDeleteSelected = useCallback(async () => {
    if (selectedDeployments.length === 0) return toast.error('No deployments selected');
    await handleDeleteResources(selectedDeployments);
    setSelectedDeployments([]);
    setSelectedDeployment(null);
  }, [selectedDeployments, handleDeleteResources]);

  const handleDeleteOne = async (item: V1Deployment) => {
    await handleDeleteResources([item]);
    setSelectedDeployment(null);
  };

  const columns: ColumnDef<keyof V1Deployment | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: '', key: '', sortable: false },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Ready', key: 'status' },
    { label: 'Age', key: 'metadata' },
    { label: 'Status', key: 'status' },
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

  const renderRow = (dep: V1Deployment) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={dep.metadata?.name ?? ''}>
          {dep.metadata?.name}
        </span>
      </Td>
      <Td className="text-center align-middle">
        {dep.status?.conditions?.some((c) => c.status === 'False') && (
          <AlertTriangle className="inline-block h-4 w-4 text-yellow-400" />
        )}
      </Td>
      <Td>
        <BadgeNamespaces name={dep.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        {dep.status?.readyReplicas ?? '0'}/{dep.status?.replicas ?? '0'}
      </Td>
      <AgeCell timestamp={dep.metadata?.creationTimestamp} />
      <Td>
        <BadgeDeploymentStatus status={dep.status?.conditions?.[0]?.type} />
      </Td>
    </>
  );

  const renderSidebar = (item: V1Deployment, tableRef: RefObject<HTMLTableElement | null>) => (
    <SidebarK8sDeployments
      item={item}
      setItem={setSelectedDeployment}
      onDelete={handleDeleteOne}
      tableRef={tableRef}
    />
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
      selectedItems={selectedDeployments}
      onToggleItem={toggleDeployment}
      onToggleAll={toggleAllDeployments}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      onRowClick={setSelectedDeployment}
      renderRow={renderRow}
      selectedItem={selectedDeployment}
      renderSidebar={renderSidebar}
    />
  );
}
