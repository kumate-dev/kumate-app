import type { V1PersistentVolumeClaim } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { K8sStatus } from '@/types/k8sStatus';

interface SidebarPVCProps {
  item: V1PersistentVolumeClaim | null;
  setItem: (item: V1PersistentVolumeClaim | null) => void;
  onDelete?: (item: V1PersistentVolumeClaim) => void;
  onEdit?: (item: V1PersistentVolumeClaim) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

const getPvcStatus = (pvc: V1PersistentVolumeClaim): K8sStatus => {
  const phase = pvc.status?.phase ?? 'Unknown';
  let variant: 'default' | 'success' | 'warning' | 'error' = 'default';
  switch (phase) {
    case 'Bound':
      variant = 'success';
      break;
    case 'Pending':
      variant = 'warning';
      break;
    case 'Lost':
      variant = 'error';
      break;
    case 'Released':
      variant = 'warning';
      break;
    default:
      variant = 'default';
  }
  return { status: phase, variant };
};

export function SidebarPersistentVolumeClaims({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarPVCProps) {
  const renderProperties = (pvc: V1PersistentVolumeClaim) => {
    const capacity = (pvc.status?.capacity as any)?.storage || '';
    const accessModes = (pvc.spec?.accessModes || []).join(', ');
    const volumeMode = pvc.spec?.volumeMode || '';
    const volumeName = pvc.spec?.volumeName || '';
    const storageClass = pvc.spec?.storageClassName || '';

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
              <Td className="break-all text-white">{pvc.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={pvc.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={pvc.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <TableYamlRow label="Labels" data={pvc.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={pvc.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getPvcStatus(pvc)} />
              </Td>
            </Tr>

            <Tr>
              <Td>Storage Class</Td>
              <Td>{storageClass || '-'}</Td>
            </Tr>

            <Tr>
              <Td>Capacity</Td>
              <Td>{capacity || '-'}</Td>
            </Tr>

            <Tr>
              <Td>Access Modes</Td>
              <Td className="break-all">{accessModes || '-'}</Td>
            </Tr>

            <Tr>
              <Td>Volume Mode</Td>
              <Td>{volumeMode || '-'}</Td>
            </Tr>

            <Tr>
              <Td>Volume Name</Td>
              <Td className="break-all">{volumeName || '-'}</Td>
            </Tr>

            <TableYamlRow
              label="Selector"
              data={pvc.spec?.selector?.matchLabels}
              maxWidthClass="lg"
            />
            <TableYamlRow label="Conditions" data={pvc.status?.conditions} maxWidthClass="xl" />
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
          content: (i: V1PersistentVolumeClaim) => renderProperties(i),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      eventsProps={
        item
          ? {
              contextName,
              namespace: item?.metadata?.namespace,
              resourceKind: 'PersistentVolumeClaim',
              resourceName: item?.metadata?.name,
            }
          : undefined
      }
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating}
      deleting={deleting}
    />
  );
}
