import type { V1RuntimeClass } from '@kubernetes/client-node';

export function templateRuntimeClass(): V1RuntimeClass {
  return {
    apiVersion: 'node.k8s.io/v1',
    kind: 'RuntimeClass',
    metadata: {
      name: 'runc',
    },
    handler: 'runc',
    overhead: undefined,
    scheduling: undefined,
  } as V1RuntimeClass;
}
