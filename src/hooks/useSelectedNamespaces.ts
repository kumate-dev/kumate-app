import { useEffect } from 'react';
import { listNamespaces } from '@/api/k8s/namespaces';
import { useNamespaceStore } from '@/store/namespaceStore';
import { K8sContext } from '@/api/k8s/contexts';
import { V1Namespace } from '@kubernetes/client-node';

export function useSelectedNamespaces(context?: K8sContext | null) {
  const namespaces = useNamespaceStore((s) => s.namespaces);
  const namespacesContext = useNamespaceStore((s) => s.namespacesContext);
  const setNamespaces = useNamespaceStore((s) => s.setNamespaces);

  useEffect(() => {
    let active = true;

    async function list() {
      if (!context?.name) return;

      if (namespacesContext === context.name && (namespaces[context.name] || []).length > 0) return;

      try {
        const res: V1Namespace[] = await listNamespaces({ name: context.name });
        if (!active) return;

        const sorted = (res || [])
          .map((item) => ({ ...item, _name: item.metadata?.name || '' }))
          .sort((a, b) => a._name.localeCompare(b._name));

        setNamespaces(context.name, sorted);
      } catch {}
    }

    list();

    return () => {
      active = false;
    };
  }, [context?.name, namespacesContext, namespaces, setNamespaces]);

  return context?.name ? namespaces[context.name] || [] : [];
}
