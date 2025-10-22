import { useState } from 'react';
import { Table, Tbody, Tr, Td } from '@/components/ui/table';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import { listJobs, watchJobs, JobItem } from '@/services/jobs';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { PaneTaskbar } from '@/components/custom/PaneTaskbar';
import AgeCell from '@/components/custom/AgeCell';
import { BadgeVariant } from '@/types/variant';
import { K8sContext } from '@/services/contexts';
import { ErrorMessage } from '@/components/custom/ErrorMessage';
import { Badge } from '@/components/ui/badge';
import { ColumnDef, TableHeader } from '@/components/custom/TableHeader';

interface PaneJobsProps {
  context?: K8sContext | null;
}

type SortKey = keyof JobItem;

export default function PaneJobs({ context }: PaneJobsProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<JobItem>(
    listJobs,
    watchJobs,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  function progressVariant(progress: string | number): BadgeVariant {
    try {
      const [succ, comp] = String(progress)
        .split('/')
        .map((x) => parseInt(x, 10));
      if (!isNaN(succ) && !isNaN(comp) && comp > 0) {
        if (succ >= comp) return 'success';
        return 'warning';
      }
      return 'default';
    } catch {
      return 'default';
    }
  }

  const columns: ColumnDef<keyof JobItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Progress', key: 'progress' },
    { label: 'Age', key: 'creation_timestamp' },
  ];

  return (
    <div className="flex h-full flex-col">
      <PaneTaskbar
        namespaceList={namespaceList}
        selectedNamespaces={selectedNamespaces}
        onSelectNamespace={setSelectedNamespaces}
        query={q}
        onQueryChange={setQ}
      />

      <ErrorMessage message={error} />

      <div className="max-h-[600px] overflow-auto rounded-xl border border-white/10 bg-neutral-900/60">
        <Table>
          <TableHeader
            columns={columns}
            sortBy={sortBy}
            sortOrder={sortOrder}
            setSortBy={setSortBy}
            setSortOrder={setSortOrder}
          />
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={5} className="text-white/60">
                  Loading...
                </Td>
              </Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={5} className="text-white/60">
                  No jobs
                </Td>
              </Tr>
            )}
            {!loading &&
              filtered.map((f) => (
                <Tr key={`${f.namespace}-${f.name}`}>
                  <Td className="max-w-truncate">
                    <span className="block truncate" title={f.name}>
                      {f.name}
                    </span>
                  </Td>
                  <Td>{f.namespace}</Td>
                  <Td>
                    <Badge variant={progressVariant(f.progress)}>{f.progress}</Badge>
                  </Td>
                  <AgeCell timestamp={f.creation_timestamp || ''} />
                  <Td>
                    <button className="text-white/60 hover:text-white/80">⋮</button>
                  </Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
