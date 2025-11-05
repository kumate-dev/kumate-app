import { V1StatefulSet } from '@kubernetes/client-node';

export const templateStatefulSet = (namespace?: string): V1StatefulSet => ({
  apiVersion: 'apps/v1',
  kind: 'StatefulSet',
  metadata: {
    name: 'example-statefulset',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
    serviceName: 'example-headless',
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
