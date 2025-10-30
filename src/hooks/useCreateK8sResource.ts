import { toast } from 'sonner';
import { useState } from 'react';

export function useCreateK8sResource<T>(
  createFn: (params: { name: string; namespace?: string; manifest: T }) => Promise<T>,
  context?: { name: string } | null
) {
  const [creating, setCreating] = useState(false);

  const handleCreateResource = async (manifest: T) => {
    const name = context?.name;
    if (!name) {
      toast.error('Missing context name for creation.');
      return;
    }

    const resourceName = (manifest as any).kind;

    setCreating(true);
    try {
      const result = await createFn({
        name: name,
        namespace: (manifest as any).metadata?.namespace,
        manifest: manifest,
      });

      toast.success(`${resourceName} ${name} created successfully`);
      return result;
    } catch (error) {
      toast.error(`Failed to create ${resourceName}: ${error}`);
      throw error;
    } finally {
      setCreating(false);
    }
  };

  return {
    handleCreateResource,
    creating,
  };
}
