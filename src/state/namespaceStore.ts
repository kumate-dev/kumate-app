import { create } from 'zustand';
import { NamespaceItem } from '@/services/namespaces';
import { ALL_NAMESPACES } from '@/constants/k8s';

interface NamespaceStore {
  selectedNamespaces: string[];
  setSelectedNamespaces: (ns: string[] | string) => void;
  namespaces: Record<string, NamespaceItem[]>; // key = context.name
  namespacesContext: string | null;
  setNamespaces: (contextName: string | null, list: NamespaceItem[]) => void;
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
