import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { useNamespaceStore } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import { CronJobItem, listCronJobs, watchCronJobs } from '../../services/cronjobs';
import AgeCell from '../shared/AgeCell';
import { BadgeVariant } from '../../types/variant';

interface PaneCronJobProps {
  context?: K8sContext | null;
}

export default function PaneCronJob({ context }: PaneCronJobProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<CronJobItem>(
    listCronJobs,
    watchCronJobs,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(items, selectedNamespaces, q, ['name', 'namespace']);

  function suspendVariant(suspend: boolean | string): BadgeVariant {
    switch (suspend) {
      case true:
      case 'true':
        return 'warning';
      case false:
      case 'false':
        return 'success';
      default:
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
              <Th>Schedule</Th>
              <Th>Suspend</Th>
              <Th>Last Schedule</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={7} className="text-white/60">
                  Loading...
                </Td>
              </Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={7} className="text-white/60">
                  No cronjobs
                </Td>
              </Tr>
            )}
            {!loading &&
              filtered.map((f) => (
                <Tr key={`${f.namespace}/${f.name}`}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td className="text-white/80">{f.namespace}</Td>
                  <Td className="text-white/80">{f.schedule}</Td>
                  <Td>
                    <Badge variant={suspendVariant(f.suspend)}>{String(f.suspend)}</Badge>
                  </Td>
                  <AgeCell timestamp={f.last_schedule || ''} />
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
