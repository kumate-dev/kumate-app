import type { V1PersistentVolume } from '@kubernetes/client-node';
import AgeCell from '@/components/common/AgeCell';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface SidebarPersistentVolumesProps {
  item: V1PersistentVolume | null;
  setItem: (item: V1PersistentVolume | null) => void;
  onDelete?: (item: V1PersistentVolume) => void;
  onEdit?: (item: V1PersistentVolume) => void;
}

export function SidebarPersistentVolumes({
  item,
  setItem,
  onDelete,
  onEdit,
}: SidebarPersistentVolumesProps) {
  const renderOverview = (pv: V1PersistentVolume) => {
    const capacity = (pv.spec?.capacity as any)?.storage || '';
    const accessModes = (pv.spec?.accessModes || []).join(', ');
    const volumeMode = pv.spec?.volumeMode || '';
    const storageClass = pv.spec?.storageClassName || '';
    const reclaimPolicy = pv.spec?.persistentVolumeReclaimPolicy || '';
    const phase = pv.status?.phase || '';
    const claimNs = pv.spec?.claimRef?.namespace || '';
    const claimName = pv.spec?.claimRef?.name || '';

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
              <Td className="break-all text-white">{pv.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={pv.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={pv.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={pv.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Status</Td>
              <Td className="break-all">{phase || '-'}</Td>
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
              <Td>Reclaim Policy</Td>
              <Td>{reclaimPolicy || '-'}</Td>
            </Tr>

            <Tr>
              <Td>Claim Ref</Td>
              <Td className="break-all">{claimName ? `${claimNs}/${claimName}` : '-'}</Td>
            </Tr>

            <TableYamlRow label="Node Affinity" data={pv.spec?.nodeAffinity} maxWidthClass="xl" />
            <TableYamlRow label="Mount Options" data={pv.spec?.mountOptions} maxWidthClass="xl" />
            <TableYamlRow label="Volume Source" data={pv.spec} maxWidthClass="xl" />
            <TableYamlRow label="Spec" data={pv.spec} maxWidthClass="xl" />
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
          content: (i: V1PersistentVolume) => renderOverview(i),
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
