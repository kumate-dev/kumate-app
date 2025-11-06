import { useState, useCallback } from 'react';
import { V1LimitRange, V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarLimitRanges } from './SidebarLimitRanges';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { templateLimitRange } from '../../templates/limitRange';

export interface PaneLimitRangesProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1LimitRange[];
  loading: boolean;
  error: string;
  onDelete: (limitRanges: V1LimitRange[]) => Promise<void>;
  onCreate?: (manifest: V1LimitRange) => Promise<V1LimitRange | undefined>;
  onUpdate?: (manifest: V1LimitRange) => Promise<V1LimitRange | undefined>;
  contextName?: string;
}

export default function PaneLimitRanges({
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
}: PaneLimitRangesProps) {
  const [sortBy, setSortBy] = useState<string>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleDeleteSelected = useCallback(
    async (toDelete: V1LimitRange[]) => {
      if (!toDelete.length) return;
      await onDelete(toDelete);
    },
    [onDelete]
  );

  const renderLimitMap = (map?: Record<string, string>): { display: string; title: string } => {
    if (!map || Object.keys(map).length === 0) return { display: '-', title: '-' };
    const text = Object.entries(map)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return { display: text, title: text };
  };

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Type', key: 'spec' },
    { label: 'Min', key: 'spec' },
    { label: 'Max', key: 'spec' },
    { label: 'Default', key: 'spec' },
    { label: 'Default Request', key: 'spec' },
    { label: 'Age', key: 'metadata' },
  ];

  const renderRow = (lr: V1LimitRange) => (
    <>
      <Td className="max-w-truncate align-middle" title={lr.metadata?.name ?? ''}>
        {lr.metadata?.name}
      </Td>
      <Td>
        <BadgeNamespaces name={lr.metadata?.namespace ?? ''} />
      </Td>
      <Td>{lr.spec?.limits?.map((l) => l.type).join(', ') || '-'}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.min).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.max).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?._default).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.defaultRequest).display}</Td>
      <AgeCell timestamp={lr.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1LimitRange,
      actions: {
        setItem: (item: V1LimitRange | null) => void;
        onDelete?: (item: V1LimitRange) => void;
        onEdit?: (item: V1LimitRange) => void;
      }
    ) => (
      <SidebarLimitRanges
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
      renderSidebar={renderSidebar}
      yamlTemplate={templateLimitRange}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
    />
  );
}
