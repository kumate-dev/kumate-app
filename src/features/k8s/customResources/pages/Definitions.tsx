import { useCallback } from 'react';
import { PaneResourceContextProps } from '@/features/k8s/generic/components/PaneGeneric';
import { PaneGeneric } from '@/features/k8s/generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import { listCustomResourceDefinitions, type CrdDefinition } from '@/api/k8s/crdDefinitions';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import AgeCell from '@/components/common/AgeCell';
import CustomResourceDefinitions from '../components/CustomResourceDefinitions';

function pickVersion(def?: CrdDefinition): string {
  const versions = def?.spec?.versions || [];
  const storage = versions.find((v) => v.storage);
  if (storage?.name) return storage.name;
  const served = versions.find((v) => v.served);
  if (served?.name) return served.name;
  return versions[0]?.name || '';
}

export default function Definitions({ context }: PaneResourceContextProps) {
  const listCrdDefs = useCallback(
    ({ name }: { name: string; namespaces?: string[] }) => listCustomResourceDefinitions({ name }),
    []
  );

  const { items, loading, error } = useListK8sResources<CrdDefinition>(
    listCrdDefs,
    undefined,
    context,
    undefined
  );

  const columns: ColumnDef<string>[] = [
    { key: 'resource', label: 'Resource' },
    { key: 'group', label: 'Group' },
    { key: 'version', label: 'Version' },
    { key: 'scope', label: 'Scope' },
    { key: 'age', label: 'Age' },
  ];

  const renderRow = useCallback((item: CrdDefinition) => {
    const kind = item?.spec?.names?.kind || '';
    const group = item?.spec?.group || '';
    const version = pickVersion(item);
    const scope = item?.spec?.scope || '';
    return (
      <>
        <Td>{kind}</Td>
        <Td>{group}</Td>
        <Td>{version}</Td>
        <Td>{scope}</Td>
        <AgeCell timestamp={item?.metadata?.creationTimestamp ?? ''} />
      </>
    );
  }, []);

  const renderSidebar = useCallback(
    (
      item: CrdDefinition,
      actions: {
        setItem: (item: CrdDefinition | null) => void;
      }
    ) => (
      <CustomResourceDefinitions
        item={item}
        setItem={actions.setItem}
        updating={false}
        deleting={false}
      />
    ),
    []
  );

  return (
    <PaneGeneric<CrdDefinition>
      items={items}
      loading={loading}
      error={error}
      columns={columns}
      renderRow={renderRow}
      renderSidebar={renderSidebar}
      showNamespace={false}
      contextName={context?.name}
      emptyText="No Custom Resource Definitions"
    />
  );
}
