import { useMemo, useState, useCallback } from 'react';
import { RightSidebarGeneric } from '@/features/k8s/generic/components/RightSidebarGeneric';
import type { PortForwardItemDto } from '@/api/k8s/portForward';
import { Table, Tbody, Tr, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Globe, Square } from 'lucide-react';
import { ModalPortForwarder } from './ModalPortForwarder';

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

  const handleEdit = useCallback(
    (i: PortForwardItemDto) => {
      setPfDialogOpen(true);
    },
    []
  );

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
          onClick={() => {
            const url = `http://localhost:${i.localPort}/`;
            window.open(url, '_blank');
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
                  <Table>
                    <Tbody>
                      <Tr>
                        <Td className="w-40 text-white/60">Name</Td>
                        <Td className="text-white/80">{i.resourceName}</Td>
                      </Tr>
                      <Tr>
                        <Td className="w-40 text-white/60">Namespace</Td>
                        <Td className="text-white/80">{i.namespace}</Td>
                      </Tr>
                      <Tr>
                        <Td className="w-40 text-white/60">Kind</Td>
                        <Td className="text-white/80">{i.resourceKind}</Td>
                      </Tr>
                      <Tr>
                        <Td className="w-40 text-white/60">Pod Port</Td>
                        <Td className="text-white/80">{i.remotePort}</Td>
                      </Tr>
                      <Tr>
                        <Td className="w-40 text-white/60">Local Port</Td>
                        <Td className="text-white/80">{i.localPort}</Td>
                      </Tr>
                      <Tr>
                        <Td className="w-40 text-white/60">Protocol</Td>
                        <Td className="text-white/80">{i.protocol}</Td>
                      </Tr>
                      <Tr>
                        <Td className="w-40 text-white/60">Status</Td>
                        <Td className="text-white/80">{i.status}</Td>
                      </Tr>
                      <Tr>
                        <Td className="w-40 text-white/60">Session ID</Td>
                        <Td className="text-white/80">{i.sessionId}</Td>
                      </Tr>
                    </Tbody>
                  </Table>

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