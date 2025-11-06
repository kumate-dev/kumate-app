import { V1LimitRange } from '@kubernetes/client-node';

export function templateLimitRange(defaultNamespace?: string): V1LimitRange {
  return {
    apiVersion: 'v1',
    kind: 'LimitRange',
    metadata: {
      name: 'example-limitrange',
      namespace: defaultNamespace,
    },
    spec: {
      limits: [
        {
          type: 'Container',
          max: { cpu: '1', memory: '1Gi' },
          min: { cpu: '100m', memory: '128Mi' },
          defaultRequest: { cpu: '200m', memory: '128Mi' },
        },
      ],
    },
  } as V1LimitRange;
}
