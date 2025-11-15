import { useEffect } from 'react';
import { useNamespaceStore } from '@/store/namespaceStore';
import { ALL_NAMESPACES } from '@/constants/k8s';

export function useResetNamespacesOnContext(selectedName?: string) {
  useEffect(() => {
    if (selectedName) {
      useNamespaceStore.setState({ selectedNamespaces: [ALL_NAMESPACES] });
    }
  }, [selectedName]);
}