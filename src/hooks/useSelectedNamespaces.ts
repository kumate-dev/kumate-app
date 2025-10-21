import { useEffect, useMemo } from 'react';
import { listNamespaces } from '../services/k8s';
import { useNamespaceStore } from '../state/namespaceStore';
import { K8sContext } from '../layouts/Sidebar';

export function useSelectedNamespaces(context?: K8sContext | null) {
  const namespacesRaw = useNamespaceStore((s) => s.namespaces);
  const namespacesContext = useNamespaceStore((s) => s.namespacesContext);
  const setNamespaces = useNamespaceStore((s) => s.setNamespaces);

  const namespaces = useMemo(() => namespacesRaw || {}, [namespacesRaw]);

  useEffect(() => {
    let active = true;

    async function fetchNamespaces() {
      if (!context?.name) return;
      if (namespacesContext === context.name && (namespaces[context.name] || []).length > 0) return;

      try {
        const res = await listNamespaces({ name: context.name });
        if (!active) return;
        const nsNames = (res || []).map((n) => n.name).sort();
        setNamespaces(
          context.name,
          nsNames.map((n) => ({ name: n }))
        );
      } catch {
        // ignore
      }
    }

    fetchNamespaces();
    return () => {
      active = false;
    };
  }, [context?.name, namespacesContext, namespaces, setNamespaces]);

  return context?.name ? namespaces[context.name] || [] : [];
}
