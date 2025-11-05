import { V1ReplicaSet } from '@kubernetes/client-node';

export const templateReplicaSet = (namespace?: string): V1ReplicaSet => ({
  apiVersion: 'apps/v1',
  kind: 'ReplicaSet',
  metadata: {
    name: 'example-replicaset',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
    replicas: 1,
    selector: { matchLabels: { app: 'example' } },
    template: {
      metadata: { labels: { app: 'example' } },
      spec: {
        containers: [
          {
            name: 'example',
            image: 'nginx:latest',
            ports: [{ containerPort: 80 }],
          },
        ],
      },
    },
  },
});
