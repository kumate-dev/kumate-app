import { V1Deployment } from '@kubernetes/client-node';

export const templateDeployment = (namespace?: string): V1Deployment => ({
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: 'example-deployment',
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
})
