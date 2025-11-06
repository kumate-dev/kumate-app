import type { V1HorizontalPodAutoscaler } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getHorizontalPodAutoscalerStatus } from '../utils/horizontalPodAutoscalersStatus';

interface SidebarHorizontalPodAutoscalersProps {
  item: V1HorizontalPodAutoscaler | null;
  setItem: (item: V1HorizontalPodAutoscaler | null) => void;
  onDelete?: (item: V1HorizontalPodAutoscaler) => void;
  onEdit?: (item: V1HorizontalPodAutoscaler) => void;
}

function renderOverview(hpa: V1HorizontalPodAutoscaler) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{hpa.metadata?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={hpa.metadata?.namespace ?? ''} />
              </Td>
            </Tr>
            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={hpa.metadata?.creationTimestamp ?? ''} />
            </Tr>
            <TableYamlRow label="Labels" data={hpa.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={hpa.metadata?.annotations} maxWidthClass="lg" />
            <Tr>
              <Td>Target</Td>
              <Td>{hpa.spec?.scaleTargetRef?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Min Replicas</Td>
              <Td>{hpa.spec?.minReplicas ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Max Replicas</Td>
              <Td>{hpa.spec?.maxReplicas ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Current</Td>
              <Td>{hpa.status?.currentReplicas ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Desired</Td>
              <Td>{hpa.status?.desiredReplicas ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getHorizontalPodAutoscalerStatus(hpa)} />
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </div>

      {Array.isArray((hpa.status as any)?.conditions) && (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
          <div className="p-4">
            <div className="font-medium text-white">Conditions</div>
            <div className="mt-2 space-y-2 text-white/80">
              {(
                (hpa.status as any)?.conditions as {
                  type?: string;
                  status?: string;
                  message?: string;
                }[]
              ).map((c, idx) => (
                <div key={idx} className="rounded border border-white/10 p-2">
                  <div>Type: {c.type ?? '-'}</div>
                  <div>Status: {c.status ?? '-'}</div>
                  {c.message && <div className="text-white/60">{c.message}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarHorizontalPodAutoscalers({
  item,
  setItem,
  onDelete,
  onEdit,
}: SidebarHorizontalPodAutoscalersProps) {
  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1HorizontalPodAutoscaler) => renderOverview(i),
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
    />
  );
}
