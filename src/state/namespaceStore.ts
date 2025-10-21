import { create } from 'zustand';

export const ALL_NAMESPACES = 'All Namespaces';

export interface NamespaceItem {
  name: string;
  status?: string;
  age?: string;
}

interface NamespaceStore {
  selectedNs: string;
  setSelectedNs: (ns?: string) => void;
  namespaces: Record<string, NamespaceItem[]>; // key = context.name
  namespacesContext: string | null;
  setNamespaces: (contextName: string | null, list: NamespaceItem[]) => void;
}

export const useNamespaceStore = create<NamespaceStore>((set) => ({
  selectedNs: ALL_NAMESPACES,
  setSelectedNs: (ns) => set({ selectedNs: ns || ALL_NAMESPACES }),
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
