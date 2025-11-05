import type { V1StorageClass } from '@kubernetes/client-node';
import AgeCell from '@/components/common/AgeCell';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

interface SidebarStorageClassesProps {
  item: V1StorageClass | null;
  setItem: (item: V1StorageClass | null) => void;
  onDelete?: (item: V1StorageClass) => void;
  onEdit?: (item: V1StorageClass) => void;
}

export function SidebarStorageClasses({
  item,
  setItem,
  onDelete,
  onEdit,
}: SidebarStorageClassesProps) {
  const renderOverview = (sc: V1StorageClass) => {
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
              <Td className="break-all text-white">{sc.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={sc.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={sc.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={sc.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Provisioner</Td>
              <Td className="break-all">{sc.provisioner ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Reclaim Policy</Td>
              <Td className="break-all">{(sc as any).reclaimPolicy ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Binding Mode</Td>
              <Td className="break-all">{sc.volumeBindingMode ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Allow Expansion</Td>
              <Td className="break-all">{sc.allowVolumeExpansion ? 'true' : 'false'}</Td>
            </Tr>

            <TableYamlRow label="Parameters" data={sc.parameters} maxWidthClass="xl" />
            <TableYamlRow label="Mount Options" data={sc.mountOptions} maxWidthClass="xl" />
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
          content: (i: V1StorageClass) => renderOverview(i),
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
