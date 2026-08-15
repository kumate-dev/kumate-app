import type { V1PriorityClass } from '@kubernetes/client-node';

export function templatePriorityClass(): V1PriorityClass {
  return {
    apiVersion: 'scheduling.k8s.io/v1',
    kind: 'PriorityClass',
    metadata: {
      name: 'high-priority',
    },
    value: 1000000,
    globalDefault: false,
    description: 'Example priority class',
  } as V1PriorityClass;
}
