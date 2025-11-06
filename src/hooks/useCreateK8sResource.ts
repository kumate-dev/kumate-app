import { toast } from 'sonner';
import { useState, useCallback, useRef } from 'react';

interface CreateResourceParams<T> {
  name: string;
  namespace?: string;
  manifest: T;
}

interface UseCreateK8sResourceReturn<T> {
  handleCreateResource: (manifest: T) => Promise<T | undefined>;
  creating: boolean;
}

export function useCreateK8sResource<
  T extends { kind?: string; metadata?: { namespace?: string } },
>(
  createFn: (params: CreateResourceParams<T>) => Promise<T>,
  context?: { name: string } | null
): UseCreateK8sResourceReturn<T> {
  const [creating, setCreating] = useState(false);
  const createFnRef = useRef(createFn);
  const contextRef = useRef(context);

  createFnRef.current = createFn;
  contextRef.current = context;

  const handleCreateResource = useCallback(async (manifest: T): Promise<T | undefined> => {
    const name = contextRef.current?.name;
    if (!name) {
      toast.error('Missing context name for application.');
      return undefined;
    }

    const resourceName = manifest.kind || 'Resource';
    const namespace = manifest.metadata?.namespace;

    setCreating(true);
    try {
      const result = await createFnRef.current({
        name,
        namespace,
        manifest,
      });
      toast.success(`${resourceName} ${name} created successfully`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to create ${resourceName}: ${errorMessage}`);
      throw error;
    } finally {
      setCreating(false);
    }
  }, []);

  return {
    handleCreateResource,
    creating,
  };
}
