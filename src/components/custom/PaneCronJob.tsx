import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { useNamespaceStore } from '../../state/namespaceStore';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import { CronJobItem, listCronJobs, watchCronJobs } from '../../services/cronjobs';
import AgeCell from '../shared/AgeCell';
import { BadgeVariant } from '../../types/variant';
import { K8sContext } from '../../services/contexts';
import { ErrorMessage } from '../shared/ErrorMessage';

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

      <ErrorMessage message={error} />

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
                  <Td className="max-w-truncate">
                    <span className="block truncate" title={f.name}>
                      {f.name}
                    </span>
                  </Td>
                  <Td>{f.namespace}</Td>
                  <Td>{f.schedule}</Td>
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
