import { V1PodDisruptionBudget } from '@kubernetes/client-node';

export function templatePodDisruptionBudget(defaultNamespace?: string): V1PodDisruptionBudget {
  return {
    apiVersion: 'policy/v1',
    kind: 'PodDisruptionBudget',
    metadata: {
      name: 'example-pdb',
      namespace: defaultNamespace,
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
