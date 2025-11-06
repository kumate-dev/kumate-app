import { useMemo, useState, useCallback } from 'react';
import { RightSidebarGeneric } from '@/features/k8s/generic/components/RightSidebarGeneric';
import { BadgeNamespaces } from '@/features/k8s/generic/components/BadgeNamespaces';
import type { PortForwardItemDto } from '@/api/k8s/portForward';
import { Table, Tbody, Tr, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Globe, Square } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ModalPortForwarder } from './ModalPortForwarder';
import { capitalizeFirstLetter } from '@/utils/string';

export interface SidebarPortForwardsProps {
  item: PortForwardItemDto | null;
  setItem: (item: PortForwardItemDto | null) => void;
  onDelete?: (item: PortForwardItemDto) => void;
  onEdit?: (item: PortForwardItemDto) => void;
  onStop: () => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarPortForwards({
  item,
  setItem,
  onDelete,
  onEdit,
  onStop,
  updating = false,
  deleting = false,
}: SidebarPortForwardsProps) {
  const [pfDialogOpen, setPfDialogOpen] = useState(false);

  const handleEdit = useCallback((i: PortForwardItemDto) => {
    setPfDialogOpen(true);
  }, []);

  const headerRight = useCallback(
    (
      i: PortForwardItemDto,
      actions: {
        showDeleteModal: () => void;
        handleEdit: () => void;
        isEditDisabled: boolean;
        isDeleteDisabled: boolean;
      }
    ) => (
      <div className="flex items-center gap-2">
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
        <Button size="sm" variant="outline" onClick={onStop} title="Stop port-forward">
          <Square className="mr-1 h-4 w-4" />
          Stop
        </Button>
      </div>
    ),
    [onStop]
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
                          <Td className="text-white">{i.status}</Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </div>

                  <ModalPortForwarder
                    open={pfDialogOpen}
                    onOpenChange={setPfDialogOpen}
                    contextName={i.context}
                    namespace={i.namespace}
                    resourceKind={i.resourceKind}
                    resourceName={i.resourceName}
                    defaultRemotePort={i.remotePort}
                  />
                </>
              ),
              headerRight,
            },
          ]
        : [],
    [item, headerRight, pfDialogOpen]
  );

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit ? onEdit : (i: PortForwardItemDto) => handleEdit(i)}
      updating={updating}
      deleting={deleting}
    />
  );
}
