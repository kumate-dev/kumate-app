import { useEffect, useMemo, useState } from 'react';
import { Table, Tbody, Td, Tr, Thead, Th } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { listEvents, type CoreV1Event } from '@/api/k8s/events';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { BadgeVariant } from '@/types/variant';

export interface SidebarEventsSectionProps {
  contextName?: string;
  namespace?: string;
  resourceKind?: string;
  resourceName?: string;
}

export function SidebarEventsSection({
  contextName,
  namespace,
  resourceKind,
  resourceName,
}: SidebarEventsSectionProps) {
  const [events, setEvents] = useState<CoreV1Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const typeVariant = (t?: string): BadgeVariant => {
    switch ((t || '').toLowerCase()) {
      case 'normal':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'secondary';
    }
  };

  const canQuery = useMemo(() => {
    // Namespace is optional: for cluster-scoped resources, query across namespaces
    return !!contextName && !!resourceName && !!resourceKind;
  }, [contextName, resourceName, resourceKind]);

  useEffect(() => {
    if (!canQuery) {
      setEvents([]);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    listEvents({
      context: contextName!,
      namespace,
      involvedObject: { name: resourceName, kind: resourceKind },
    })
      .then((list) => {
        if (cancelled) return;
        const sorted = [...(list || [])].sort((a, b) => {
          const ta = a.lastTimestamp || a.metadata?.creationTimestamp || '';
          const tb = b.lastTimestamp || b.metadata?.creationTimestamp || '';
          const da = ta ? new Date(ta).getTime() : 0;
          const db = tb ? new Date(tb).getTime() : 0;
          return db - da; // desc
        });
        setEvents(sorted);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err?.message || err || 'Failed to load events'));
        setEvents([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canQuery, contextName, namespace, resourceKind, resourceName]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[100px]" />
          <col className="w-[160px]" />
          <col className="w-auto" />
          <col className="w-[120px]" />
        </colgroup>
        <Thead>
          <Tr>
            <Th>Type</Th>
            <Th>Reason</Th>
            <Th>Message</Th>
            <Th>Age</Th>
          </Tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr>
              <Td colSpan={4} className="text-center">
                Loading events...
              </Td>
            </Tr>
          ) : error ? (
            <Tr>
              <Td colSpan={4} className="text-center text-red-400">
                {error}
              </Td>
            </Tr>
          ) : events.length === 0 ? (
            <Tr>
              <Td colSpan={4} className="text-center">
                No events found
              </Td>
            </Tr>
          ) : (
            events.map((ev, idx) => (
              <Tr key={`${ev.metadata?.name || ev.reason || 'ev'}-${idx}`}>
                <Td>
                  <Badge variant={typeVariant(ev.type)}>{ev.type || 'Unknown'}</Badge>
                </Td>
                <Td>{ev.reason || '-'}</Td>
                <Td className="max-w-truncate text-white/80">
                  {ev.message ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate">{ev.message}</span>
                      </TooltipTrigger>
                      <TooltipContent className="border border-gray-700 bg-gray-900 text-white">
                        {ev.message}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    '-'
                  )}
                </Td>
                <Td className="w-[120px]">
                  <AgeCell timestamp={ev.lastTimestamp || ev.metadata?.creationTimestamp || ''} />
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </div>
  );
}