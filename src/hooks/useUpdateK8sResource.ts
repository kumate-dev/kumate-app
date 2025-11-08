import { toast } from 'sonner';
import { useState, useCallback, useRef } from 'react';

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
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
