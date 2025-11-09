import type { V1ValidatingWebhookConfiguration } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface Props {
  item: V1ValidatingWebhookConfiguration;
  setItem: (item: V1ValidatingWebhookConfiguration | null) => void;
  onDelete?: (item: V1ValidatingWebhookConfiguration) => void;
  onEdit?: (item: V1ValidatingWebhookConfiguration) => void;
  updating?: boolean;
  deleting?: boolean;
  contextName?: string;
}

export default function SidebarValidatingWebhooks({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: Props) {
  const renderProperties = (vw: V1ValidatingWebhookConfiguration) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{vw.metadata?.name ?? '-'}</Td>
          </Tr>
          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={vw.metadata?.creationTimestamp ?? ''} />
          </Tr>
          <TableYamlRow label="Labels" data={vw.metadata?.labels} maxWidthClass="xl" />
          <TableYamlRow label="Annotations" data={vw.metadata?.annotations} maxWidthClass="xl" />
          <Tr>
            <Td>Webhooks</Td>
            <Td>{vw.webhooks?.length ?? 0}</Td>
          </Tr>
          <TableYamlRow label="webhooks" data={vw.webhooks} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ValidatingWebhookConfiguration) => renderProperties(i),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      onDelete={onDelete}
      onEdit={onEdit}
      sections={sections}
      eventsProps={
        item
          ? {
              contextName,
              resourceKind: 'ValidatingWebhookConfiguration',
              resourceName: item?.metadata?.name,
            }
          : undefined
      }
      updating={updating}
      deleting={deleting}
    />
  );
}
