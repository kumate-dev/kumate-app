import { create } from 'zustand';
import { V1Namespace } from '@kubernetes/client-node';
import { ALL_NAMESPACES } from '@/constants/k8s';

interface NamespaceStore {
  selectedNamespaces: string[];
  setSelectedNamespaces: (ns: string[] | string) => void;
  namespaces: Record<string, V1Namespace[]>;
  namespacesContext: string | null;
  setNamespaces: (contextName: string | null, list: V1Namespace[]) => void;
}

export const useNamespaceStore = create<NamespaceStore>((set) => ({
  selectedNamespaces: [ALL_NAMESPACES],
  setSelectedNamespaces: (ns) =>
    set({
      selectedNamespaces:
        typeof ns === 'string' ? [ns || ALL_NAMESPACES] : ns.length ? ns : [ALL_NAMESPACES],
    }),
  namespaces: {},
  namespacesContext: null,
  setNamespaces: (contextName, list) =>
    set({
      namespaces: {
        ...(contextName ? { [contextName]: list } : {}),
      },
      namespacesContext: contextName || null,
    }),
}));
