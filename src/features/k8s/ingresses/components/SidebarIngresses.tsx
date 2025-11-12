import type { V1Ingress } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

export interface SidebarIngressesProps {
  item: V1Ingress;
  setItem: (item: V1Ingress | null) => void;
  onDelete?: (item: V1Ingress) => void;
  onEdit?: (item: V1Ingress) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarIngresses({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarIngressesProps) {
  const renderProperties = (ing: V1Ingress) => {
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
            <TableYamlRow label="Rules" data={ing.spec?.rules} maxWidthClass="xl" />
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
          content: (i: V1Ingress) => renderProperties(i),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem as any}
      onDelete={onDelete as any}
      onEdit={onEdit as any}
      sections={sections}
      eventsProps={
        item
          ? {
              contextName,
              namespace: item?.metadata?.namespace,
              resourceKind: 'Ingress',
              resourceName: item?.metadata?.name,
            }
          : undefined
      }
      updating={updating}
      deleting={deleting}
    />
  );
}

export default SidebarIngresses;
