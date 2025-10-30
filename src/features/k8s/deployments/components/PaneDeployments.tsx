import { useState, useCallback, RefObject, useMemo } from 'react';
import { V1Deployment, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { SidebarK8sDeployments } from './SidebarDeployments';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { getDeploymentStatus } from '../utils/deploymentStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import BottomYamlEditor from '@/components/common/BottomYamlEditor';
import yaml from 'js-yaml';
import { ALL_NAMESPACES } from '@/constants/k8s';
import { templateDeployment } from '../../templates/TemplateDeployment';
import { toast } from 'sonner';

export interface PaneDeploymentsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Deployment[];
  loading: boolean;
  error: string;
  onDelete: (deployments: V1Deployment[]) => Promise<void>;
  onCreateResource?: (manifest: V1Deployment) => Promise<V1Deployment | undefined>;
  onUpdateResource?: (manifest: V1Deployment) => Promise<V1Deployment | undefined>;
  contextName?: string;
}

export default function PaneDeployments({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDelete,
  onCreateResource,
  onUpdateResource,
  contextName,
}: PaneDeploymentsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Deployment>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1Deployment[]>([]);
  const [selectedItem, setSelectedItem] = useState<V1Deployment | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState<string>('');
  const [editorYaml, setEditorYaml] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');

  const defaultNamespace = useMemo(() => {
    if (!selectedNamespaces || selectedNamespaces.length === 0) return undefined;
    const ns = selectedNamespaces[0];
    return ns === ALL_NAMESPACES ? undefined : ns;
  }, [selectedNamespaces]);

  const toggleItem = useCallback((dep: V1Deployment) => {
    setSelectedItems((prev) =>
      prev.includes(dep) ? prev.filter((d) => d !== dep) : [...prev, dep]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    await onDelete(selectedItems);
    setSelectedItems([]);
    setSelectedItem(null);
  }, [selectedItems, onDelete]);

  const handleDeleteOne = async (item: V1Deployment) => {
    await onDelete([item]);
    setSelectedItem(null);
  };

  const openCreateEditor = () => {
    setEditorTitle('Create Deployment');
    setEditorYaml(yaml.dump(templateDeployment(defaultNamespace)));
    setEditorMode('create');
    setEditorOpen(true);
  };

  const openEditEditor = (item: V1Deployment) => {
    setEditorTitle(`Edit Deployment: ${item.metadata?.name ?? ''}`);
    setEditorYaml(yaml.dump(item));
    setEditorMode('edit');
    setEditorOpen(true);
  };

  const handleSave = async (manifest: any) => {
    if (!contextName) {
      toast.error('Missing context name.');
      return;
    }

    try {
      if (editorMode === 'create') {
        await onCreateResource?.(manifest as V1Deployment);
      } else {
        await onUpdateResource?.(manifest as V1Deployment);
      }
      setEditorOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const columns: ColumnDef<keyof V1Deployment | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Ready', key: 'status' },
    { label: 'Age', key: 'metadata' },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const renderRow = (dep: V1Deployment) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={dep.metadata?.name ?? ''}>
          {dep.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={dep.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <BadgeStatus status={getDeploymentStatus(dep)} />
      </Td>
      <AgeCell timestamp={dep.metadata?.creationTimestamp} />
    </>
  );

  const renderSidebar = (item: V1Deployment, tableRef: RefObject<HTMLTableElement | null>) => (
    <SidebarK8sDeployments
      item={item}
      setItem={setSelectedItem}
      onDelete={handleDeleteOne}
      onEdit={openEditEditor}
      tableRef={tableRef}
    />
  );

  return (
    <>
      <PaneGeneric
        items={items}
        loading={loading}
        error={error}
        query={q}
        onQueryChange={setQ}
        namespaceList={namespaceList}
        selectedNamespaces={selectedNamespaces}
        onSelectNamespace={onSelectNamespace}
        selectedItems={selectedItems}
        onToggleItem={toggleItem}
        onCreate={openCreateEditor}
        onDelete={handleDeleteSelected}
        colSpan={columns.length + 1}
        tableHeader={tableHeader}
        onRowClick={setSelectedItem}
        renderRow={renderRow}
        selectedItem={selectedItem}
        renderSidebar={renderSidebar}
      />
      <BottomYamlEditor
        open={editorOpen}
        title={editorTitle}
        mode={editorMode}
        initialYaml={editorYaml}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
