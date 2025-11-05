import type { V1Ingress } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

export interface SidebarIngressesProps {
  item: V1Ingress;
  setItem: (item: V1Ingress | null) => void;
  onDelete?: (item: V1Ingress) => void;
  onEdit?: (item: V1Ingress) => void;
}

export function SidebarIngresses({ item, setItem, onDelete, onEdit }: SidebarIngressesProps) {
  const renderOverview = (ing: V1Ingress) => {
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
              <Td className="break-all text-white">{ing.metadata?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={ing.metadata?.namespace ?? ''} />
              </Td>
            </Tr>
            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={ing.metadata?.creationTimestamp ?? ''} />
            </Tr>
            <Tr>
              <Td>Class</Td>
              <Td className="break-all text-white">{ing.spec?.ingressClassName ?? '-'}</Td>
            </Tr>
            <TableYamlRow label="Labels" data={ing.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={ing.metadata?.annotations} maxWidthClass="lg" />
          </Tbody>
        </Table>
      </div>
    );
  };

  const renderRules = (ing: V1Ingress) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <TableYamlRow label="Rules" data={ing.spec?.rules} maxWidthClass="xl" />
    </div>
  );

  return (
    <SidebarGeneric
      item={item}
      setItem={setItem as any}
      onDelete={onDelete as any}
      onEdit={onEdit as any}
      sections={{ Overview: renderOverview, Rules: renderRules }}
    />
  );
}

export default SidebarIngresses;
