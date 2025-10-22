import { useState } from 'react';
import { Table, Tbody, Tr, Td } from '@/components/ui/table';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import { DaemonSetItem, listDaemonSets, watchDaemonSets } from '@/services/daemonsets';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { PaneTaskbar } from '@/components/custom/PaneTaskbar';
import AgeCell from '@/components/custom/AgeCell';
import { readyVariant } from '@/utils/k8s';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/custom/ErrorMessage';
import { K8sContext } from '@/services/contexts';
import { BadgeVariant } from '@/types/variant';
import { ColumnDef, TableHeader } from '@/components/custom/TableHeader';

interface PaneDaemonSetsProps {
  context?: K8sContext | null;
}

type SortKey = keyof DaemonSetItem;

export default function PaneDaemonSets({ context }: PaneDaemonSetsProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);
  const { items, loading, error } = useK8sResources<DaemonSetItem>(
    listDaemonSets,
    watchDaemonSets,
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

  const columns: ColumnDef<keyof DaemonSetItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Ready', key: 'ready' },
    { label: 'Age', key: 'creation_timestamp' },
    { label: '', key: 'empty', sortable: false },
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

      <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <div className="h-full overflow-auto">
          <div className="min-w-max">
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
                      No daemonsets
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
                      <Td>
                        <Badge variant={readyVariant(f.ready) as BadgeVariant}>{f.ready}</Badge>
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
      </div>
    </div>
  );
}
