import { useCallback, useMemo, useState } from 'react';
import { V1Deployment } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listDeployments, watchDeployments, deleteDeployments, applyDeployment } from '@/api/k8s/deployments';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneDeployments from '../components/PaneDeployments';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import BottomYamlEditor from '@/components/common/BottomYamlEditor';
import yaml from 'js-yaml';
import { ALL_NAMESPACES } from '@/constants/k8s';
import { templateDeployment } from '../../templates/TemplateDeployment';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function Deployments({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Deployment>(
    listDeployments,
    watchDeployments,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1Deployment>(deleteDeployments, context);

  const handleDeleteDeployments = useCallback(
    async (deployments: V1Deployment[]) => {
      if (deployments.length === 0) {
        toast.error('No deployments selected');
        return;
      }
      await handleDeleteResources(deployments);
    },
    [handleDeleteResources]
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState<string>('');
  const [editorYaml, setEditorYaml] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');

  const defaultNamespace = useMemo(() => {
    if (!selectedNamespaces || selectedNamespaces.length === 0) return undefined;
    const ns = selectedNamespaces[0];
    return ns === ALL_NAMESPACES ? undefined : ns;
  }, [selectedNamespaces]);

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

  const handleSave = async (manifest: V1Deployment) => {
    const name = context?.name;
    if (!name) {
      toast.error('Missing context name.');
      return;
    }
    
    if (editorMode === 'create') {
      const { handleCreateResource } = useCreateK8sResource<V1Deployment>(applyDeployment, context);
      await handleCreateResource(manifest);
    } else {
      const { handleUpdateResource } = useUpdateK8sResource<V1Deployment>(applyDeployment, context);
      await handleUpdateResource(manifest);
    }
  };

  return (
    <>
      <PaneDeployments
        selectedNamespaces={selectedNamespaces}
        onSelectNamespace={setSelectedNamespaces}
        namespaceList={namespaceList}
        items={items}
        loading={loading}
        error={error ?? ''}
        onDeleteDeployments={handleDeleteDeployments}
        onCreate={openCreateEditor}
        onEdit={openEditEditor}
      />
      <BottomYamlEditor
        open={editorOpen}
        title={editorTitle}
        initialYaml={editorYaml}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
