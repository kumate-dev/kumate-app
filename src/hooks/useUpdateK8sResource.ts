import { toast } from 'sonner';
import { useState } from 'react';

export function useUpdateK8sResource<T>(
  updateFn: (params: { name: string; namespace?: string; manifest: T;}) => Promise<T>,
  context?: { name: string } | null
) {
  const [updating, setUpdating] = useState(false);

  const handleUpdateResource = async (manifest: T) => {  
    const name = context?.name;
    if (!name) {
      toast.error('Missing context name for application.');
      return;
    }

    const resourceName = (manifest as any).kind;

    setUpdating(true);
    try {
      await updateFn({
        name: name,
        namespace: (manifest as any).metadata?.namespace,
        manifest: manifest,
      });
      toast.success(`${resourceName} ${name} updated successfully`);
      return manifest;
    } catch (error) {
      toast.error(`Failed to update ${resourceName}: ${error}`);
      throw error;
    } finally {
      setUpdating(false);
    }
  };

  return {
    handleUpdateResource,
    updating,
  };
}
