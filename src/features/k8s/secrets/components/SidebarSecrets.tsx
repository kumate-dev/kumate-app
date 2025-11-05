import type { V1Secret } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getSecretTypeStatus } from '../utils/secretTypeStatus';

interface SidebarSecretsProps {
  item: V1Secret | null;
  setItem: (item: V1Secret | null) => void;
  onDelete?: (item: V1Secret) => void;
  onEdit?: (item: V1Secret) => void;
}

export function SidebarSecrets({ item, setItem, onDelete, onEdit }: SidebarSecretsProps) {
  const renderOverview = (secret: V1Secret) => {
    const dataKeys = secret.data ? Object.keys(secret.data) : [];

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
              <Td className="break-all text-white">{secret.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={secret.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={secret.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <TableYamlRow label="Labels" data={secret.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow
              label="Annotations"
              data={secret.metadata?.annotations}
              maxWidthClass="xl"
            />

            <Tr>
              <Td>Type</Td>
              <Td>
                <BadgeStatus status={getSecretTypeStatus(secret)} />
              </Td>
            </Tr>

            <Tr>
              <Td>Immutable</Td>
              <Td>{secret.immutable ? 'true' : 'false'}</Td>
            </Tr>

            <Tr>
              <Td>Data Keys</Td>
              <Td className="break-all">{dataKeys.length ? dataKeys.join(', ') : '-'}</Td>
            </Tr>

            <TableYamlRow label="String Data" data={secret.stringData} maxWidthClass="xl" />
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
          content: (i: V1Secret) => renderOverview(i),
        },
      ]
    : [];

  return (
    <SidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );
}
