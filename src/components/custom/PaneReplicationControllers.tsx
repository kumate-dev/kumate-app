import { useState } from 'react';
import { Table, Tbody, Tr, Td } from '@/components/ui/table';
import { readyVariant } from '@/utils/k8s';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import {
  listReplicationControllers,
  ReplicationControllerItem,
  watchReplicationControllers,
} from '@/services/replicationcontrollers';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { PaneTaskbar } from '@/components/custom/PaneTaskbar';
import AgeCell from '@/components/custom/AgeCell';
import { ColumnDef, TableHeader } from '@/components/custom/TableHeader';
import { K8sContext } from '@/services/contexts';
import { ErrorMessage } from '@/components/custom/ErrorMessage';
import { Badge } from '@/components/ui/badge';

interface PaneReplicationControllersProps {
  context?: K8sContext | null;
}

type SortKey = keyof ReplicationControllerItem;

export default function PaneReplicationControllers({ context }: PaneReplicationControllersProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<ReplicationControllerItem>(
    listReplicationControllers,
    watchReplicationControllers,
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

  const columns: ColumnDef<keyof ReplicationControllerItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Ready', key: 'ready' },
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
                    <Td colSpan={6} className="text-white/60">
                      Loading...
                    </Td>
                  </Tr>
                )}
                {!loading && filtered.length === 0 && (
                  <Tr>
                    <Td colSpan={6} className="text-white/60">
                      No replicationcontrollers
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
                        <Badge variant={readyVariant(f.ready)}>{f.ready}</Badge>
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
