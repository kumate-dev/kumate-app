import { create } from "zustand";

const ALL = "All Namespaces";

export const useNamespaceStore = create((set) => ({
  selectedNs: ALL,
  setSelectedNs: (ns) => set({ selectedNs: ns || ALL }),
  namespaces: [],
  namespacesContext: null,
  setNamespaces: (contextName, list) =>
    set({
      namespaces: Array.isArray(list) ? list : [],
      namespacesContext: contextName || null,
    }),
}));