import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { useNamespaceStore } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listJobs } from '../../services/jobs';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import { JobItem, watchJobs } from '../../services/jobs';
import AgeCell from '../shared/AgeCell';
import { BadgeVariant } from '../../types/variant';

interface PaneJobsProps {
  context?: K8sContext | null;
}

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
  const filtered = useFilteredItems(items, selectedNamespaces, q, ['name', 'namespace']);

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

  return (
    <div className="space-y-3">
      <PaneTaskbar
        namespaceList={namespaceList}
        selectedNamespaces={selectedNamespaces}
        onSelectNamespace={setSelectedNamespaces}
        query={q}
        onQueryChange={setQ}
      />

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Namespace</Th>
              <Th>Progress</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
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
                <Tr key={f.name}>
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
