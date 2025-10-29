import { toast } from 'sonner';
import type { K8sResponse } from '@/types/k8sResponse';

export function useDeleteK8sResources<T>(
  deleteFn: (params: {
    name: string;
    namespace: string;
    resourceNames: string[];
  }) => Promise<K8sResponse[]>,
  context?: { name: string } | null
) {
  const handleDeleteResources = async (resources: T[]) => {
    if (!context?.name) {
      toast.error('Missing context name for deletion.');
      return;
    }

    const namespaceMap: Record<string, string[]> = {};

    resources.forEach((r) => {
      const meta: any = (r as any).metadata ?? {};
      const ns = meta.namespace || '';
      const name = meta.name;

      if (!name) return;

      if (!namespaceMap[ns]) namespaceMap[ns] = [];
      namespaceMap[ns].push(name);
    });

    for (const ns in namespaceMap) {
      try {
        const results = await deleteFn({
          name: context.name,
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
