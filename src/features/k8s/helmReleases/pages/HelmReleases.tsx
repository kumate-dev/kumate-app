import { useCallback } from 'react';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listHelmReleases, watchHelmReleases, uninstallHelmReleases } from '@/api/k8s/helm';
import { PaneResourceContextProps } from '@/features/k8s/generic/components/PaneGeneric';
import { PaneGeneric } from '@/features/k8s/generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import { toast } from 'sonner';

type Release = {
  metadata?: { name?: string; namespace?: string };
  name?: string;
  namespace?: string;
  revision?: string;
  updated?: string;
  status?: string;
  chart?: string;
  app_version?: string;
};

export default function HelmReleases({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<Release>(
    listHelmReleases,
    watchHelmReleases,
    context,
    selectedNamespaces
  );

  const columns: ColumnDef<string>[] = [
    { key: 'name', label: 'Name' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'revision', label: 'Revision' },
    { key: 'updated', label: 'Updated' },
    { key: 'status', label: 'Status' },
    { key: 'chart', label: 'Chart' },
    { key: 'app_version', label: 'App Version' },
  ];

  const renderRow = useCallback(
    (item: Release) => (
      <>
        <Td className="py-2">{item.metadata?.name ?? item.name ?? ''}</Td>
        <Td className="py-2">{item.metadata?.namespace ?? item.namespace ?? ''}</Td>
        <Td className="py-2">{item.revision ?? ''}</Td>
        <Td className="py-2">{item.updated ?? ''}</Td>
        <Td className="py-2">{item.status ?? ''}</Td>
        <Td className="py-2">{item.chart ?? ''}</Td>
        <Td className="py-2">{item.app_version ?? ''}</Td>
      </>
    ),
    []
  );

  const onDelete = useCallback(
    async (sel: Release[]) => {
      if (!context?.name) return;
      const ns = selectedNamespaces && selectedNamespaces[0];
      const namespace = !ns || ns === 'ALL_NAMESPACES' ? undefined : ns;
      const names = sel
        .map((i) => i.metadata?.name || i.name)
        .filter(Boolean) as string[];

      try {
        await uninstallHelmReleases({ name: context.name, namespace, releaseNames: names });
        toast.success(`Uninstalled ${names.length} release(s)`);
      } catch (err) {
        toast.error(`Uninstall failed: ${err}`);
      }
    },
    [context?.name, selectedNamespaces]
  );

  return (
    <PaneGeneric<Release>
      items={items}
      loading={loading}
      error={error}
      namespaceList={namespaceList as any}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      columns={columns}
      renderRow={renderRow}
      onDelete={onDelete}
      showNamespace={true}
      contextName={context?.name}
    />
  );
}