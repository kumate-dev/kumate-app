import { useMemo } from 'react';

export function useDefaultNamespace(
  selectedNamespaces?: string[],
  allNamespacesKey = 'ALL_NAMESPACES'
): string | undefined {
  return useMemo(() => {
    if (!selectedNamespaces || selectedNamespaces.length === 0) return undefined;
    const ns = selectedNamespaces[0];
    return ns === allNamespacesKey ? undefined : ns;
  }, [selectedNamespaces, allNamespacesKey]);
}
