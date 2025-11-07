import { useState, useCallback } from 'react';
import { V1PodDisruptionBudget, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarPodDisruptionBudgets } from './SidebarPodDisruptionBudgets';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { getPodDisruptionBudgetsStatus } from '../utils/podDisruptionBudgetsStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { templatePodDisruptionBudget } from '../../templates/podDisruptionBudget';

export interface PanePodDisruptionBudgetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1PodDisruptionBudget[];
  loading: boolean;
  error: string;
  onDelete: (pdbs: V1PodDisruptionBudget[]) => Promise<void>;
  onCreate?: (manifest: V1PodDisruptionBudget) => Promise<V1PodDisruptionBudget | undefined>;
  onUpdate?: (manifest: V1PodDisruptionBudget) => Promise<V1PodDisruptionBudget | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PanePodDisruptionBudgets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
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
}: PanePodDisruptionBudgetsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
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

  const renderSidebar = useCallback(
    (
      item: V1PodDisruptionBudget,
      actions: {
        setItem: (item: V1PodDisruptionBudget | null) => void;
        onDelete?: (item: V1PodDisruptionBudget) => void;
        onEdit?: (item: V1PodDisruptionBudget) => void;
      }
    ) => (
      <SidebarPodDisruptionBudgets
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
      items={items}
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
      onDelete={onDelete}
      renderRow={renderRow}
      yamlTemplate={templatePodDisruptionBudget}
      onCreate={onCreate}
      onUpdate={onUpdate}
      renderSidebar={renderSidebar}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
