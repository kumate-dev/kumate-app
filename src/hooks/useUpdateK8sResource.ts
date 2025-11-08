import { toast } from 'sonner';
import { useState, useCallback, useRef } from 'react';
import { getErrorMessage } from '@/utils/error';

interface UpdateResourceParams<T> {
  name: string;
  namespace?: string;
  manifest: T;
}

interface ResourceManifest {
  kind?: string;
  metadata?: {
    namespace?: string;
    name?: string;
  };
}

export function useUpdateK8sResource<T extends ResourceManifest>(
  updateFn: (params: UpdateResourceParams<T>) => Promise<T>,
  context?: { name: string } | null
) {
  const [updating, setUpdating] = useState(false);
  const updateFnRef = useRef(updateFn);
  const contextRef = useRef(context);

  updateFnRef.current = updateFn;
  contextRef.current = context;

  const handleUpdateResource = useCallback(async (manifest: T): Promise<T | undefined> => {
    const name = contextRef.current?.name;
    if (!name) {
      toast.error('Missing context name for application.');
      return undefined;
    }

    const resourceName = manifest.kind || 'Resource';
    const namespace = manifest.metadata?.namespace;

    setUpdating(true);
    try {
      const result = await updateFnRef.current({
        name,
        namespace,
        manifest,
      });
      toast.success(`Successfully updated ${resourceName}: ${manifest.metadata?.name}`);
      return result;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Failed to update ${resourceName}: ${errorMessage}`);
      throw error;
    } finally {
      setUpdating(false);
    }
  }, []);

  return {
    handleUpdateResource,
    updating,
  };
}
