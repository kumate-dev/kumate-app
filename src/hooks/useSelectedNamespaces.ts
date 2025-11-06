import { useEffect } from 'react';
import { listNamespaces } from '@/api/k8s/namespaces';
import { useNamespaceStore } from '@/store/namespaceStore';
import { K8sContext } from '@/api/k8s/contexts';
import { V1Namespace } from '@kubernetes/client-node';

export function useSelectedNamespaces(context?: K8sContext | null) {
  const namespaces = useNamespaceStore((s) => s.namespaces);
  const namespacesContext = useNamespaceStore((s) => s.namespacesContext);
  const setNamespaces = useNamespaceStore((s) => s.setNamespaces);

  const contextName = context?.name;
  const currentNamespaces = contextName ? namespaces[contextName] : [];

  const isDataAvailable = namespacesContext === contextName && currentNamespaces.length > 0;

  useEffect(() => {
    if (!contextName || isDataAvailable) return;

    let active = true;

    const fetchNamespaces = async () => {
      try {
        const response: V1Namespace[] = await listNamespaces({ name: contextName });

        if (!active) return;

        const sortedNamespaces = (response || [])
          .map((namespace) => ({
            ...namespace,
            _name: namespace.metadata?.name || '',
          }))
          .sort((a, b) => a._name.localeCompare(b._name));

        setNamespaces(contextName, sortedNamespaces);
      } catch (error) {
        console.error('Failed to fetch namespaces:', error);
      }
    };

    fetchNamespaces();

    return () => {
      active = false;
    };
  }, [contextName, isDataAvailable, setNamespaces]);

  return currentNamespaces;
}
