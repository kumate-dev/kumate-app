import { useState, useCallback } from 'react';
import { V1HorizontalPodAutoscaler, V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarHorizontalPodAutoscalers } from './SidebarHorizontalPodAutoscalers';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '@/features/k8s/generic/components/BadgeStatus';
import { getHorizontalPodAutoscalerStatus } from '../utils/horizontalPodAutoscalersStatus';
import { templateHorizontalPodAutoscaler } from '../../templates/horizontalPodAutoscaler';

export interface PaneHorizontalPodAutoscalersProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1HorizontalPodAutoscaler[];
  loading: boolean;
  error: string;
  onDeleteHorizontalPodAutoscalers: (hpas: V1HorizontalPodAutoscaler[]) => Promise<void>;
  onCreate?: (
    manifest: V1HorizontalPodAutoscaler
  ) => Promise<V1HorizontalPodAutoscaler | undefined>;
  onUpdate?: (
    manifest: V1HorizontalPodAutoscaler
  ) => Promise<V1HorizontalPodAutoscaler | undefined>;
  contextName?: string;
}

export default function PaneHorizontalPodAutoscalers({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteHorizontalPodAutoscalers,
  onCreate,
  onUpdate,
  contextName,
}: PaneHorizontalPodAutoscalersProps) {
  const [sortBy, setSortBy] = useState<string>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleDeleteSelected = useCallback(
    async (toDelete: V1HorizontalPodAutoscaler[]) => {
      if (!toDelete.length) return;
      await onDeleteHorizontalPodAutoscalers(toDelete);
    },
    [onDeleteHorizontalPodAutoscalers]
  );

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Target', key: 'spec' },
    { label: 'Min', key: 'spec' },
    { label: 'Max', key: 'spec' },
    { label: 'Current', key: 'status' },
    { label: 'Desired', key: 'status' },
    { label: 'Age', key: 'metadata' },
    { label: 'Status', key: 'status' },
  ];

  const renderRow = (hpa: V1HorizontalPodAutoscaler) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={hpa.metadata?.name ?? ''}>
          {hpa.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={hpa.metadata?.namespace ?? ''} />
      </Td>
      <Td>{hpa.spec?.scaleTargetRef?.name ?? '-'}</Td>
      <Td>{hpa.spec?.minReplicas ?? '-'}</Td>
      <Td>{hpa.spec?.maxReplicas ?? '-'}</Td>
      <Td>{hpa.status?.currentReplicas ?? '-'}</Td>
      <Td>{hpa.status?.desiredReplicas ?? '-'}</Td>
      <AgeCell timestamp={hpa.metadata?.creationTimestamp ?? ''} />
      <Td>
        <BadgeStatus status={getHorizontalPodAutoscalerStatus(hpa)} />
      </Td>
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1HorizontalPodAutoscaler,
      actions: {
        setItem: (item: V1HorizontalPodAutoscaler | null) => void;
        onDelete?: (item: V1HorizontalPodAutoscaler) => void;
        onEdit?: (item: V1HorizontalPodAutoscaler) => void;
      }
    ) => (
      <SidebarHorizontalPodAutoscalers
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
      onDelete={handleDeleteSelected}
      renderRow={renderRow}
      yamlTemplate={templateHorizontalPodAutoscaler}
      onCreate={onCreate}
      onUpdate={onUpdate}
      renderSidebar={renderSidebar}
      contextName={contextName}
    />
  );
}
