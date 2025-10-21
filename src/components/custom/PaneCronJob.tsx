import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { relativeAge } from '../../utils/time';
import { suspendVariant } from '../../utils/k8s';
import { useNamespaceStore, ALL_NAMESPACES } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listCronJobs } from '../../services/k8s';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';

interface CronJob {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  last_schedule?: string;
  creation_timestamp: string;
}

interface PaneCronJobProps {
  context?: K8sContext | null;
}

export default function PaneCronJob({ context }: PaneCronJobProps) {
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);

  const namespaceList = useSelectedNamespaces(context);
  const nsParam = selectedNs === ALL_NAMESPACES ? undefined : selectedNs;

  const { items, loading, error } = useK8sResources<CronJob>(
    listCronJobs as (params: { name: string; namespace?: string }) => Promise<CronJob[]>,
    context,
    nsParam
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(items, q);

  return (
    <div className="space-y-3">
      <PaneTaskbar
        namespaceList={namespaceList}
        selectedNs={selectedNs}
        onSelectNamespace={setSelectedNs}
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
              filtered.map((d) => (
                <Tr key={d.name}>
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="text-white/80">{d.namespace}</Td>
                  <Td className="text-white/80">{d.schedule}</Td>
                  <Td>
                    <Badge variant={suspendVariant(d.suspend)}>{String(d.suspend)}</Badge>
                  </Td>
                  <Td className="text-white/80">
                    {d.last_schedule ? relativeAge(d.last_schedule) : '-'}
                  </Td>
                  <Td className="text-white/80">{relativeAge(d.creation_timestamp)}</Td>
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
