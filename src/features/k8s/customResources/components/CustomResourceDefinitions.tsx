import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import type { CrdDefinition } from '@/api/k8s/crdDefinitions';

interface SidebarDefinitionsProps {
  item: CrdDefinition | null;
  setItem: (item: CrdDefinition | null) => void;
  onDelete?: (item: CrdDefinition) => void;
  onEdit?: (item: CrdDefinition) => void;
  updating?: boolean;
  deleting?: boolean;
}

export default function CustomResourceDefinitions({
  item,
  setItem,
  onDelete,
  onEdit,
  updating,
  deleting,
}: SidebarDefinitionsProps) {
  const renderProperties = (def: CrdDefinition) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{def.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={def.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Group</Td>
            <Td className="break-all">{def.spec?.group ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Scope</Td>
            <Td>{def.spec?.scope ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Kind</Td>
            <Td>{def.spec?.names?.kind ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Plural</Td>
            <Td>{def.spec?.names?.plural ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Singular</Td>
            <Td>{def.spec?.names?.singular ?? '-'}</Td>
          </Tr>

          <TableYamlRow label="Labels" data={(def as any)?.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow
            label="Annotations"
            data={(def as any)?.metadata?.annotations}
            maxWidthClass="xl"
          />

          <TableYamlRow label="Versions" data={def.spec?.versions as any} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [{ key: 'properties', title: 'Properties', content: (i: CrdDefinition) => renderProperties(i) }]
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
