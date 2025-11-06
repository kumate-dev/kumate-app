import type { V1Service } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface SidebarServicesProps {
  item: V1Service | null;
  setItem: (item: V1Service | null) => void;
  onDelete?: (item: V1Service) => void;
  onEdit?: (item: V1Service) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarServices({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarServicesProps) {
  const renderOverview = (svc: V1Service) => {
    const clusterIPs = svc.spec?.clusterIPs || (svc.spec?.clusterIP ? [svc.spec.clusterIP] : []);
    const externalIPs = svc.spec?.externalIPs || [];
    const lbIngress = svc.status?.loadBalancer?.ingress || [];
    const portsStr = (svc.spec?.ports || [])
      .map((p) => {
        const name = p.name ? `${p.name}:` : '';
        const proto = p.protocol ? `/${p.protocol}` : '';
        const target = p.targetPort ? ` → ${String(p.targetPort)}` : '';
        return `${name}${p.port}${proto}${target}`;
      })
      .join(', ');

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
              <Td className="break-all">{portsStr || '-'}</Td>
            </Tr>

            <TableYamlRow label="Selector" data={svc.spec?.selector} maxWidthClass="lg" />
          </Tbody>
        </Table>
      </div>
    );
  };

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Service) => renderOverview(i),
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
