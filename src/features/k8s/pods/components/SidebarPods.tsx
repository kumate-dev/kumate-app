import type { V1Pod } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getPodStatus } from '../utils/podStatus';

interface SidebarPodsProps {
  item: V1Pod | null;
  setItem: (item: V1Pod | null) => void;
  onDelete?: (item: V1Pod) => void;
  onEdit?: (item: V1Pod) => void;
}

export function SidebarPods({ item, setItem, onDelete, onEdit }: SidebarPodsProps) {
  const renderOverview = (pod: V1Pod) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{pod.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Namespace</Td>
            <Td>
              <BadgeNamespaces name={pod.metadata?.namespace ?? ''} />
            </Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={pod.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <TableYamlRow label="Labels" data={pod.metadata?.labels} />

          <Tr>
            <Td>Node</Td>
            <Td>{pod.spec?.nodeName ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>QoS</Td>
            <Td>{pod.status?.qosClass ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Controlled By</Td>
            <Td>{pod.metadata?.ownerReferences?.map((o) => o.name).join(', ') || '-'}</Td>
          </Tr>

          <Tr>
            <Td>Containers</Td>
            <Td>{pod.spec?.containers?.map((c) => c.name).join(', ') || '-'}</Td>
          </Tr>

          <Tr>
            <Td>Restarts</Td>
            <Td>
              {pod.status?.containerStatuses?.reduce((acc, s) => acc + (s.restartCount || 0), 0) ??
                0}
            </Td>
          </Tr>

          <Tr>
            <Td>Pod IP</Td>
            <Td>{pod.status?.podIP ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Host IP</Td>
            <Td>{pod.status?.hostIP ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Service Account</Td>
            <Td>{pod.spec?.serviceAccountName ?? 'default'}</Td>
          </Tr>

          <Tr>
            <Td>Status</Td>
            <Td>
              <BadgeStatus status={getPodStatus(pod)} />
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Pod) => renderOverview(i),
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
