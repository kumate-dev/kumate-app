import { V1PodDisruptionBudget } from '@kubernetes/client-node';

export function templatePodDisruptionBudget(name?: string, namespace?: string): V1PodDisruptionBudget {
  return {
    apiVersion: 'policy/v1',
    kind: 'PodDisruptionBudget',
    metadata: {
      name: name || 'example-pdb',
      namespace: namespace || 'default',
    },
    spec: {
      maxUnavailable: 1,
      selector: {
        matchLabels: {
          app: 'example-app',
        },
      },
    },
  } as unknown as V1PodDisruptionBudget;
}
