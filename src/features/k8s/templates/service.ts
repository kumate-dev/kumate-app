import { V1Service } from '@kubernetes/client-node';

export const templateService = (namespace?: string): V1Service => ({
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: 'example-service',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
    selector: { app: 'example' },
    type: 'ClusterIP',
    ports: [
      {
        name: 'http',
        port: 80,
        targetPort: 80,
        protocol: 'TCP',
      },
    ],
  },
} as unknown as V1Service);