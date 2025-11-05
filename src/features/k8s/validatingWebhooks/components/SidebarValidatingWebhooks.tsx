import type { V1ValidatingWebhookConfiguration } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

interface Props {
  item: V1ValidatingWebhookConfiguration;
  setItem: (item: V1ValidatingWebhookConfiguration | null) => void;
  onDelete?: (item: V1ValidatingWebhookConfiguration) => void;
  onEdit?: (item: V1ValidatingWebhookConfiguration) => void;
}

export default function SidebarValidatingWebhooks({ item, setItem, onDelete, onEdit }: Props) {
  const renderOverview = (vw: V1ValidatingWebhookConfiguration) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="max-w-truncate align-middle">
              <span className="block truncate" title={vw.metadata?.name ?? ''}>
                {vw.metadata?.name}
              </span>
            </Td>
          </Tr>
          <Tr>
            <Td>Webhooks</Td>
            <Td>{vw.webhooks?.length ?? 0}</Td>
          </Tr>
          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={vw.metadata?.creationTimestamp ?? ''} />
          </Tr>
        </Tbody>
      </Table>
    </div>
  );

  const renderMetadata = (vw: V1ValidatingWebhookConfiguration) => (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <div className="p-4">
          <div className="font-medium text-white">Labels</div>
          <div className="mt-2">
            <TableYamlRow label="Labels" data={vw.metadata?.labels} maxWidthClass="xl" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <div className="p-4">
          <div className="font-medium text-white">Annotations</div>
          <div className="mt-2">
            <TableYamlRow label="Annotations" data={vw.metadata?.annotations} maxWidthClass="xl" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderWebhooks = (vw: V1ValidatingWebhookConfiguration) => (
    <div className="space-y-2 overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="font-medium text-white">Webhooks</div>
      <div className="mt-2">
        <TableYamlRow label="webhooks" data={vw.webhooks} maxWidthClass="xl" />
      </div>
    </div>
  );

  return (
    <SidebarGeneric
      item={item}
      setItem={setItem}
      onDelete={onDelete}
      onEdit={onEdit}
      sections={[
        { key: 'overview', title: 'Overview', content: renderOverview },
        { key: 'metadata', title: 'Metadata', content: renderMetadata },
        { key: 'webhooks', title: 'Webhooks', content: renderWebhooks },
      ]}
    />
  );
}
