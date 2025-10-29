import { useState, useCallback, RefObject } from 'react';
import { V1Deployment, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { SidebarK8sDeployments } from './SidebarDeployments';
import { PaneResource } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { getDeploymentStatus } from '../utils/deploymentStatus';
import { BadgeStatus } from '../../common/components/BadgeStatus';

export interface PaneDeploymentsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Deployment[];
  loading: boolean;
  error: string;
  onDeleteDeployments: (deployments: V1Deployment[]) => Promise<void>;
}

export default function PaneDeployments({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteDeployments,
}: PaneDeploymentsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Deployment>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1Deployment[]>([]);
  const [selectedItem, setSelectedItem] = useState<V1Deployment | null>(null);

  const toggleItem = useCallback((dep: V1Deployment) => {
    setSelectedItems((prev) =>
      prev.includes(dep) ? prev.filter((d) => d !== dep) : [...prev, dep]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    await onDeleteDeployments(selectedItems);
    setSelectedItems([]);
    setSelectedItem(null);
  }, [selectedItems, onDeleteDeployments]);

  const handleDeleteOne = async (item: V1Deployment) => {
    await onDeleteDeployments([item]);
    setSelectedItem(null);
  };

  const columns: ColumnDef<keyof V1Deployment | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Ready', key: 'status' },
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

  const renderRow = (dep: V1Deployment) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={dep.metadata?.name ?? ''}>
          {dep.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={dep.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <BadgeStatus status={getDeploymentStatus(dep)} />
      </Td>
      <AgeCell timestamp={dep.metadata?.creationTimestamp} />
    </>
  );

  const renderSidebar = (item: V1Deployment, tableRef: RefObject<HTMLTableElement | null>) => (
    <SidebarK8sDeployments
      item={item}
      setItem={setSelectedItem}
      onDelete={handleDeleteOne}
      tableRef={tableRef}
    />
  );

  return (
    <PaneResource
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
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      onRowClick={setSelectedItem}
      renderRow={renderRow}
      selectedItem={selectedItem}
      renderSidebar={renderSidebar}
    />
  );
}
