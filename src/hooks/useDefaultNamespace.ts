import { useMemo } from 'react';

export function useDefaultNamespace(
  selectedNamespaces?: string[],
  allNamespacesKey = 'ALL_NAMESPACES'
): string | undefined {
  return useMemo(() => {
    if (!selectedNamespaces?.length) return undefined;

    const firstNamespace = selectedNamespaces[0];
    return firstNamespace === allNamespacesKey ? undefined : firstNamespace;
  }, [selectedNamespaces, allNamespacesKey]);
}
