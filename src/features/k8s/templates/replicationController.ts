import { V1ReplicationController } from '@kubernetes/client-node';

export const templateReplicationController = (namespace?: string): V1ReplicationController => ({
  apiVersion: 'v1',
  kind: 'ReplicationController',
  metadata: {
    name: 'example-rc',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
    replicas: 1,
    selector: { app: 'example' },
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
