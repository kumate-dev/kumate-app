import type { V1PodDisruptionBudget } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getPodDisruptionBudgetsStatus } from '../utils/podDisruptionBudgetsStatus';

interface SidebarPodDisruptionBudgetsProps {
  item: V1PodDisruptionBudget | null;
  setItem: (item: V1PodDisruptionBudget | null) => void;
  onDelete?: (item: V1PodDisruptionBudget) => void;
  onEdit?: (item: V1PodDisruptionBudget) => void;
  updating?: boolean;
  deleting?: boolean;
}

function renderOverview(pdb: V1PodDisruptionBudget) {
  const selector = pdb.spec?.selector?.matchLabels as
    | Record<string, string | number | undefined>
    | undefined;
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
              <Td className="break-all text-white">{pdb.metadata?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={pdb.metadata?.namespace ?? ''} />
              </Td>
            </Tr>
            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={pdb.metadata?.creationTimestamp ?? ''} />
            </Tr>
            <TableYamlRow label="Labels" data={pdb.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={pdb.metadata?.annotations} maxWidthClass="lg" />
            <Tr>
              <Td>Min Available</Td>
              <Td>{(pdb.spec as any)?.minAvailable ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Max Unavailable</Td>
              <Td>{(pdb.spec as any)?.maxUnavailable ?? '-'}</Td>
            </Tr>
            <TableYamlRow label="Selector" data={selector} maxWidthClass="lg" />
            <Tr>
              <Td>Current Healthy</Td>
              <Td>{pdb.status?.currentHealthy ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Desired Healthy</Td>
              <Td>{pdb.status?.desiredHealthy ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Disruptions Allowed</Td>
              <Td>{pdb.status?.disruptionsAllowed ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getPodDisruptionBudgetsStatus(pdb)} />
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </div>

      {Array.isArray(pdb.status?.conditions) && pdb.status?.conditions?.length ? (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
          <div className="p-4">
            <div className="font-medium text-white">Conditions</div>
            <div className="mt-2 space-y-2 text-white/80">
              {(pdb.status?.conditions || []).map((c, idx) => (
                <div key={idx} className="rounded border border-white/10 p-2">
                  <div>Type: {c.type ?? '-'}</div>
                  <div>Status: {c.status ?? '-'}</div>
                  {c.reason && <div>Reason: {c.reason}</div>}
                  {c.message && <div className="text-white/60">{c.message}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SidebarPodDisruptionBudgets({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarPodDisruptionBudgetsProps) {
  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1PodDisruptionBudget) => renderOverview(i),
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
