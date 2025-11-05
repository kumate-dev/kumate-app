import { useMemo, useState, useCallback } from 'react';
import type { V1NetworkPolicy, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarNetworkPolicies } from './SidebarNetworkPolicies';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import { templateNetworkPolicy } from '../../templates/networkPolicy';

export interface PaneNetworkPoliciesProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1NetworkPolicy[];
  loading: boolean;
  error: string;
  onDeleteNetworkPolicies: (policies: V1NetworkPolicy[]) => Promise<void>;
  onCreate?: (manifest: V1NetworkPolicy) => Promise<V1NetworkPolicy | undefined>;
  onUpdate?: (manifest: V1NetworkPolicy) => Promise<V1NetworkPolicy | undefined>;
  contextName?: string;
}

export default function PaneNetworkPolicies({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteNetworkPolicies,
  onCreate,
  onUpdate,
  contextName,
}: PaneNetworkPoliciesProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleDeleteSelected = useCallback(
    async (toDelete: V1NetworkPolicy[]) => {
      if (!toDelete.length) return;
      await onDeleteNetworkPolicies(toDelete);
    },
    [onDeleteNetworkPolicies]
  );

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Policy Types', key: 'policyTypes', sortable: true },
    { label: 'Pod Selector', key: 'podSelector', sortable: true },
    { label: 'Ingress Rules', key: 'ingress', sortable: true },
    { label: 'Egress Rules', key: 'egress', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1NetworkPolicy) => item.metadata?.name || '',
      namespace: (item: V1NetworkPolicy) => item.metadata?.namespace || '',
      policyTypes: (item: V1NetworkPolicy) => (item.spec?.policyTypes || []).join(', '),
      podSelector: (item: V1NetworkPolicy) => {
        const labels = item.spec?.podSelector?.matchLabels || {};
        const entries = Object.entries(labels).map(([k, v]) => `${k}=${v}`);
        return entries.join(', ');
      },
      ingress: (item: V1NetworkPolicy) => (item.spec?.ingress || []).length,
      egress: (item: V1NetworkPolicy) => (item.spec?.egress || []).length,
      age: (item: V1NetworkPolicy) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (np: V1NetworkPolicy) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={np.metadata?.name ?? ''}>
          {np.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={np.metadata?.namespace ?? ''} />
      </Td>
      <Td>{(np.spec?.policyTypes || []).join(', ') || '-'}</Td>
      <Td className="max-w-truncate align-middle">
        <span
          className="block truncate"
          title={(() => {
            const labels = np.spec?.podSelector?.matchLabels || {};
            const entries = Object.entries(labels).map(([k, v]) => `${k}=${v}`);
            return entries.join(', ');
          })()}
        >
          {(() => {
            const labels = np.spec?.podSelector?.matchLabels || {};
            const entries = Object.entries(labels).map(([k, v]) => `${k}=${v}`);
            return entries.join(', ') || '—';
          })()}
        </span>
      </Td>
      <Td>{(np.spec?.ingress || []).length}</Td>
      <Td>{(np.spec?.egress || []).length}</Td>
      <AgeCell timestamp={np.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1NetworkPolicy,
      actions: {
        setItem: (item: V1NetworkPolicy | null) => void;
        onDelete?: (item: V1NetworkPolicy) => void;
        onEdit?: (item: V1NetworkPolicy) => void;
      }
    ) => (
      <SidebarNetworkPolicies
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
      />
    ),
    []
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
      onDelete={handleDeleteSelected}
      renderRow={renderRow}
      yamlTemplate={templateNetworkPolicy}
      onCreate={onCreate}
      onUpdate={onUpdate}
      renderSidebar={renderSidebar}
      contextName={contextName}
    />
  );
}
