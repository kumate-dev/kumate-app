import type { V1NetworkPolicy } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

export interface SidebarNetworkPoliciesProps {
  item: V1NetworkPolicy | null;
  setItem: (item: V1NetworkPolicy | null) => void;
  onDelete?: (item: V1NetworkPolicy) => void;
  onEdit?: (item: V1NetworkPolicy) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarNetworkPolicies({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarNetworkPoliciesProps) {
  const renderProperties = (np: V1NetworkPolicy) => {
    const policyTypes = np.spec?.policyTypes || [];
    const podSelector = np.spec?.podSelector?.matchLabels || {};
    const ingress = np.spec?.ingress || [];
    const egress = np.spec?.egress || [];

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
              <Td className="break-all text-white">{np.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={np.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={np.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <TableYamlRow label="Labels" data={np.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={np.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Policy Types</Td>
              <Td>{policyTypes.length ? policyTypes.join(', ') : '-'}</Td>
            </Tr>

            <TableYamlRow label="Pod Selector" data={podSelector} maxWidthClass="lg" />

            <Tr>
              <Td>Ingress Rules</Td>
              <Td>{ingress.length}</Td>
            </Tr>

            <Tr>
              <Td>Egress Rules</Td>
              <Td>{egress.length}</Td>
            </Tr>

            <TableYamlRow label="Spec" data={np.spec} maxWidthClass="xl" />
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
          content: (i: V1NetworkPolicy) => renderProperties(i),
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
      hideFooterActions
    />
  );
}
