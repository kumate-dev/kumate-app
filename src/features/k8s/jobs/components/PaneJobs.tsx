import { useCallback, useMemo, useState } from 'react';
import { V1Job, V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getJobStatus } from '../utils/jobStatus';
import { sortItems } from '@/utils/sort';
import { SidebarJobs } from './SidebarJobs';
import { templateJob } from '../../templates/job';
import { V1Job as Job } from '@kubernetes/client-node';

export interface PaneJobsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Job[];
  loading: boolean;
  error: string;
  onDelete: (jobs: V1Job[]) => Promise<void>;
  contextName?: string;
  onCreate?: (manifest: Job) => Promise<Job | undefined>;
  onUpdate?: (manifest: Job) => Promise<Job | undefined>;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneJobs({
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
}: PaneJobsProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
    { label: 'Status', key: 'status', sortable: false },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1Job) => item.metadata?.name || '',
      namespace: (item: V1Job) => item.metadata?.namespace || '',
      age: (item: V1Job) => new Date(item.metadata?.creationTimestamp || '').getTime(),
      status: (item: V1Job) => getJobStatus(item),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (job: V1Job) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={job.metadata?.name ?? ''}>
          {job.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={job.metadata?.namespace ?? ''} />
      </Td>
      <AgeCell timestamp={job.metadata?.creationTimestamp ?? ''} />
      <Td>
        <BadgeStatus status={getJobStatus(job)} />
      </Td>
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1Job,
      actions: {
        setItem: (item: V1Job | null) => void;
        onDelete?: (item: V1Job) => void;
        onEdit?: (item: V1Job) => void;
      }
    ) => (
      <SidebarJobs
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
      items={sortedItems}
      loading={loading}
      error={error}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      renderRow={renderRow}
      emptyText="No jobs found"
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateJob}
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
