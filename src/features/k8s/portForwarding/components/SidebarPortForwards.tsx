import { useMemo, useCallback } from 'react';
import { RightSidebarGeneric } from '@/features/k8s/generic/components/RightSidebarGeneric';
import { BadgeNamespaces } from '@/features/k8s/generic/components/BadgeNamespaces';
import type { PortForwardItemDto } from '@/api/k8s/portForward';
import { Table, Tbody, Tr, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Globe, Square, Play } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { capitalizeFirstLetter } from '@/utils/string';
import { getPortForwardingStatus } from '../utils/portForwardingStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';

export interface SidebarPortForwardsProps {
  item: PortForwardItemDto | null;
  setItem: (item: PortForwardItemDto | null) => void;
  onDelete?: (item: PortForwardItemDto) => void;
  onStop: () => void;
  onStart: () => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarPortForwards({
  item,
  setItem,
  onDelete,
  onStop,
  onStart,
  updating = false,
  deleting = false,
}: SidebarPortForwardsProps) {
  const headerRight = useCallback(
    (i: PortForwardItemDto) => (
      <div className="flex items-center gap-2">
        {!updating && i.status === 'Running' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const isHttps = i.remotePort === 443 || i.remotePort === 8443;
              const url = `${isHttps ? 'https' : 'http'}://localhost:${i.localPort}/`;
              try {
                await openUrl(url);
              } catch {
                try {
                  window.open(url, '_blank');
                } catch {}
              }
            }}
            title="Open in browser"
          >
            <Globe className="mr-1 h-4 w-4" />
            Open
          </Button>
        )}
        {i.status === 'Running' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              try {
                onStop();
              } finally {
                setItem(null);
              }
            }}
            title="Stop port-forward"
          >
            <Square className="mr-1 h-4 w-4" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              try {
                onStart();
              } finally {
                // Close sidebar immediately after action
                setItem(null);
              }
            }}
            title="Start port-forward"
          >
            <Play className="mr-1 h-4 w-4" />
            Start
          </Button>
        )}
      </div>
    ),
    [onStop, onStart, setItem, updating]
  );

  const sections = useMemo(
    () =>
      item
        ? [
            {
              key: 'properties',
              title: 'Properties',
              content: (i: PortForwardItemDto) => (
                <>
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
                    <Table className="table-fixed">
                      <colgroup>
                        <col className="w-1/4" />
                        <col className="w-3/4" />
                      </colgroup>
                      <Tbody>
                        <Tr>
                          <Td>Name</Td>
                          <Td className="break-all text-white">{i.resourceName}</Td>
                        </Tr>
                        <Tr>
                          <Td>Namespace</Td>
                          <Td>
                            <BadgeNamespaces name={i.namespace} />
                          </Td>
                        </Tr>
                        <Tr>
                          <Td>Kind</Td>
                          <Td className="text-white">{capitalizeFirstLetter(i.resourceKind)}</Td>
                        </Tr>
                        <Tr>
                          <Td>Pod Port</Td>
                          <Td className="text-white">{i.remotePort}</Td>
                        </Tr>
                        <Tr>
                          <Td>Local Port</Td>
                          <Td className="text-white">{i.localPort}</Td>
                        </Tr>
                        <Tr>
                          <Td>Protocol</Td>
                          <Td className="text-white">{i.protocol}</Td>
                        </Tr>
                        <Tr>
                          <Td>Status</Td>
                          <Td>
                            <BadgeStatus status={getPortForwardingStatus(i.status)} />
                          </Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </div>
                </>
              ),
              headerRight,
            },
          ]
        : [],
    [item, headerRight]
  );

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      updating={updating}
      deleting={deleting}
    />
  );
}
