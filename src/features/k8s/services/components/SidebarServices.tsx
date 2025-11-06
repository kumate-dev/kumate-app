import type { V1Service } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ModalPortForwarder } from '@/features/k8s/portForwarding/components/ModalPortForwarder';

interface SidebarServicesProps {
  item: V1Service | null;
  setItem: (item: V1Service | null) => void;
  onDelete?: (item: V1Service) => void;
  onEdit?: (item: V1Service) => void;
  updating?: boolean;
  deleting?: boolean;
  contextName?: string;
}

export function SidebarServices({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
  contextName,
}: SidebarServicesProps) {
  const [pfDialogOpen, setPfDialogOpen] = useState(false);
  const [selectedRemotePort, setSelectedRemotePort] = useState<number | undefined>(undefined);
  const renderProperties = (svc: V1Service) => {
    const clusterIPs = svc.spec?.clusterIPs || (svc.spec?.clusterIP ? [svc.spec.clusterIP] : []);
    const externalIPs = svc.spec?.externalIPs || [];
    const lbIngress = svc.status?.loadBalancer?.ingress || [];
    const ports = svc.spec?.ports || [];

    return (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{svc.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={svc.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={svc.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <TableYamlRow label="Labels" data={svc.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={svc.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Type</Td>
              <Td>{svc.spec?.type ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Cluster IPs</Td>
              <Td>{clusterIPs.length ? clusterIPs.join(', ') : '-'}</Td>
            </Tr>

            <Tr>
              <Td>External IPs</Td>
              <Td>{externalIPs.length ? externalIPs.join(', ') : '-'}</Td>
            </Tr>

            <Tr>
              <Td>LoadBalancer Ingress</Td>
              <Td>
                {lbIngress.length
                  ? lbIngress
                      .map((i) => i.ip || i.hostname || '')
                      .filter(Boolean)
                      .join(', ')
                  : '-'}
              </Td>
            </Tr>

            <Tr>
              <Td>Session Affinity</Td>
              <Td>{svc.spec?.sessionAffinity ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Ports</Td>
              <Td className="break-all">
                {ports.length === 0 ? (
                  '-'
                ) : (
                  <div className="rounded-md border border-white/10 bg-white/5">
                    <Table className="w-full table-fixed">
                      <colgroup>
                        <col className="w-auto" />
                        <col className="w-[120px]" />
                      </colgroup>
                      <Tbody>
                        {ports.map((p, idx) => (
                          <Tr key={idx}>
                            <Td>
                              <span className="text-white">{p.port}</span>
                              <span className="text-white/60">/{p.protocol || 'TCP'}</span>
                              {p.name && <span className="ml-2 text-white/60">{p.name}</span>}
                              {p.targetPort && (
                                <span className="ml-2 text-white/50">→ {String(p.targetPort)}</span>
                              )}
                            </Td>
                            <Td className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-w-[96px] px-3"
                                onClick={() => {
                                  setSelectedRemotePort(p.port || 0);
                                  setPfDialogOpen(true);
                                }}
                                disabled={!contextName || deleting || updating}
                              >
                                Forward...
                              </Button>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </div>
                )}
              </Td>
            </Tr>

            <TableYamlRow label="Selector" data={svc.spec?.selector} maxWidthClass="lg" />
          </Tbody>
        </Table>
        {/** per-port forward list removed; ports are now inline in Properties **/}
      </div>
    );
  };

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Service) => (
            <>
              {renderProperties(i)}
              <ModalPortForwarder
                open={pfDialogOpen}
                onOpenChange={setPfDialogOpen}
                contextName={contextName}
                namespace={i.metadata?.namespace || ''}
                resourceKind="service"
                resourceName={i.metadata?.name || ''}
                defaultRemotePort={selectedRemotePort}
              />
            </>
          ),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating}
      deleting={deleting}
    />
  );
}
