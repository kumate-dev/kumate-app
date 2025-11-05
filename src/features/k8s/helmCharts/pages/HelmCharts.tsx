import { useCallback } from 'react';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listHelmCharts } from '@/api/k8s/helm';
import {
  PaneGeneric,
  PaneResourceContextProps,
} from '@/features/k8s/generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';

type Chart = {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  name?: string;
  chart_version?: string;
  app_version?: string;
  description?: string;
  urls?: string[];
};

export default function HelmCharts({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<Chart>(
    listHelmCharts,
    undefined,
    context,
    undefined
  );

  const columns: ColumnDef<string>[] = [
    { key: 'name', label: 'Name' },
    { key: 'chart_version', label: 'Chart Version' },
    { key: 'app_version', label: 'App Version' },
    { key: 'description', label: 'Description' },
  ];

  const renderRow = useCallback(
    (item: Chart) => (
      <>
        <Td className="py-2">{item.name ?? ''}</Td>
        <Td className="py-2">{item.chart_version ?? ''}</Td>
        <Td className="py-2">{item.app_version ?? ''}</Td>
        <Td className="py-2">{item.description ?? ''}</Td>
      </>
    ),
    []
  );

  const onDelete = useCallback(async (_items: Chart[]) => {
    // Charts are read-only in this pane; no delete operation.
  }, []);

  return (
    <PaneGeneric<Chart>
      items={items}
      loading={loading}
      error={error}
      columns={columns}
      renderRow={renderRow}
      onDelete={onDelete}
      showNamespace={false}
      contextName={context?.name}
    />
  );
}
