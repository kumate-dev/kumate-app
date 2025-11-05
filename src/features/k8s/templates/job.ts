import { V1Job } from '@kubernetes/client-node';

export const templateJob = (namespace?: string): V1Job => ({
  apiVersion: 'batch/v1',
  kind: 'Job',
  metadata: {
    name: 'example-job',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
    backoffLimit: 4,
    template: {
      metadata: { labels: { app: 'example' } },
      spec: {
        restartPolicy: 'Never',
        containers: [
          {
            name: 'example',
            image: 'busybox:latest',
            command: ['sh', '-c', 'echo Hello from Job && sleep 5'],
          },
        ],
      },
    },
  },
});
