import { toast } from 'sonner';
import { useState, useCallback } from 'react';
import type { K8sResponse } from '@/types/k8sResponse';

interface DeleteResourcesParams {
  name: string;
  namespace: string;
  resourceNames: string[];
}

interface ResourceMetadata {
  metadata?: {
    namespace?: string;
    name?: string;
  };
}

export function useDeleteK8sResources<T extends ResourceMetadata>(
  deleteFn: (params: DeleteResourcesParams) => Promise<K8sResponse[]>,
  context?: { name: string } | null
) {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteResources = useCallback(
    async (resources: T[]): Promise<void> => {
      if (!context?.name) {
        toast.error('Missing context name for deletion.');
        return;
      }

      if (!resources?.length) {
        toast.info('No resources selected for deletion.');
        return;
      }

      setDeleting(true);

      const namespaceMap = new Map<string, string[]>();

      for (const resource of resources) {
        const namespace = resource.metadata?.namespace || '';
        const name = resource.metadata?.name;

        if (!name) {
          console.warn('Resource missing name, skipping:', resource);
          continue;
        }

        if (!namespaceMap.has(namespace)) {
          namespaceMap.set(namespace, []);
        }
        namespaceMap.get(namespace)!.push(name);
      }

      try {
        const deletionPromises = Array.from(namespaceMap.entries()).map(
          async ([namespace, resourceNames]) => {
            try {
              const results = await deleteFn({
                name: context.name,
                namespace,
                resourceNames,
              });
              results.forEach((result) => {
                if (result.Err) {
                  toast.error(`Deletion error: ${result.Err}`);
                }
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const namespaceLabel = namespace || 'default';

              toast.error(
                `Failed to delete resources in ${namespaceLabel} namespace: ${errorMessage}`
              );
            }
          }
        );

        await Promise.allSettled(deletionPromises);
      } finally {
        setDeleting(false);
      }
    },
    [context?.name, deleteFn]
  );

  return {
    handleDeleteResources,
    deleting,
  };
}
