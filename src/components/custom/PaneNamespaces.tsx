import { useMemo, useState } from 'react';
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { statusVariant } from '../../utils/k8s';
import { RelativeAge } from '../shared/RelativeAge';
import { useNamespacesWatcher } from '../../hooks/useNamespacesWatcher';

interface PaneNamespacesProps {
  context?: {
    name?: string;
  };
}

export default function PaneNamespaces({ context }: PaneNamespacesProps) {
  const { items, error } = useNamespacesWatcher(context?.name);
  const [q, setQ] = useState<string>('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

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
              <Th>Status</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 && (
              <Tr>
                <Td colSpan={4} className="text-white/60">
                  No namespaces
                </Td>
              </Tr>
            )}
            {items.map((n) => (
              <Tr key={n.name}>
                <Td className="font-medium">{n.name}</Td>
                <Td>
                  <Badge variant={statusVariant(n.status ?? 'Unknown')}>
                    {n.status || 'Unknown'}
                  </Badge>
                </Td>
                <Td className="text-white/80">
                  <RelativeAge iso={n.age} />
                </Td>
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
