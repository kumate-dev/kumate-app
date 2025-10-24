import { toast } from 'sonner';
import type { K8sResponse } from '@/types/k8sResponse';

export function useDeleteK8sResources<T extends { name: string; namespace?: string }>(
  deleteFn: (params: {
    name: string;
    namespace: string;
    resourceNames: string[];
  }) => Promise<K8sResponse[]>,
  context?: { name: string } | null
) {
  const handleDeleteResources = async (resources: T[]) => {
    const namespaceMap: Record<string, string[]> = {};

    resources.forEach((r) => {
      const ns = r.namespace || '';
      if (!namespaceMap[ns]) namespaceMap[ns] = [];
      namespaceMap[ns].push(r.name);
    });

    for (const ns in namespaceMap) {
      try {
        const results = await deleteFn({
          name: context?.name!,
          namespace: ns,
          resourceNames: [...namespaceMap[ns]],
        });

        results.forEach((res) => {
          if (res.Err) toast.error(res.Err);
        });
      } catch (err) {
        toast.error(`${err}`);
        toast.error(`Unexpected error while deleting resources in namespace: ${ns}`);
      }
    }
  };

  return { handleDeleteResources };
}
