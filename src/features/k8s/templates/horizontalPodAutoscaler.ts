import { V1HorizontalPodAutoscaler } from '@kubernetes/client-node';

export function templateHorizontalPodAutoscaler(
  defaultNamespace?: string
): V1HorizontalPodAutoscaler {
  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: 'example-hpa',
      namespace: defaultNamespace,
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: 'example-deployment',
      },
      minReplicas: 1,
      maxReplicas: 5,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: 50,
            },
          },
        },
      ],
    },
  } as unknown as V1HorizontalPodAutoscaler;
}
