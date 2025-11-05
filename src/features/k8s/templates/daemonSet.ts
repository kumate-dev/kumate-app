import { V1DaemonSet } from '@kubernetes/client-node';

export const templateDaemonSet = (namespace?: string): V1DaemonSet => ({
  apiVersion: 'apps/v1',
  kind: 'DaemonSet',
  metadata: {
    name: 'example-daemonset',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
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
