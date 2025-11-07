import { useCallback, useMemo, useState } from 'react';
import { V1CronJob, V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getCronJobStatus } from '../utils/cronJobStatus';
import { sortItems } from '@/utils/sort';
import { SidebarCronJobs } from './SidebarCronJobs';
import { templateCronJob } from '../../templates/cronJob';
import { V1CronJob as CronJob } from '@kubernetes/client-node';

export interface PaneCronJobsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1CronJob[];
  loading: boolean;
  error: string;
  onDelete: (cronJobs: V1CronJob[]) => Promise<void>;
  onCreate?: (manifest: CronJob) => Promise<CronJob | undefined>;
  onUpdate?: (manifest: CronJob) => Promise<CronJob | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneCronJobs({
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
}: PaneCronJobsProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Schedule', key: 'schedule', sortable: true },
    { label: 'Status', key: 'status', sortable: false },
    { label: 'Last Schedule', key: 'lastSchedule', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1CronJob) => item.metadata?.name || '',
      namespace: (item: V1CronJob) => item.metadata?.namespace || '',
      schedule: (item: V1CronJob) => item.spec?.schedule || '',
      status: (item: V1CronJob) => getCronJobStatus(item),
      lastSchedule: (item: V1CronJob) => new Date(item.status?.lastScheduleTime || '').getTime(),
      age: (item: V1CronJob) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (cj: V1CronJob) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={cj.metadata?.name ?? ''}>
          {cj.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={cj.metadata?.namespace ?? ''} />
      </Td>
      <Td>{cj.spec?.schedule ?? '-'}</Td>
      <Td>
        <BadgeStatus status={getCronJobStatus(cj)} />
      </Td>
      <AgeCell timestamp={cj.status?.lastScheduleTime ?? ''} />
      <AgeCell timestamp={cj.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1CronJob,
      actions: {
        setItem: (item: V1CronJob | null) => void;
        onDelete?: (item: V1CronJob) => void;
        onEdit?: (item: V1CronJob) => void;
      }
    ) => (
      <SidebarCronJobs
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
        contextName={contextName}
        updating={updating}
        deleting={deleting}
      />
    ),
    [updating, deleting, contextName]
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
      renderRow={renderRow}
      emptyText="No cron jobs found"
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateCronJob}
      onCreate={onCreate}
      onUpdate={onUpdate}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
