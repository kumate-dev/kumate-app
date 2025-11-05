import { V1CronJob } from '@kubernetes/client-node';

export const templateCronJob = (namespace?: string): V1CronJob => ({
  apiVersion: 'batch/v1',
  kind: 'CronJob',
  metadata: {
    name: 'example-cronjob',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
    schedule: '*/5 * * * *',
    suspend: false,
    jobTemplate: {
      spec: {
        template: {
          metadata: { labels: { app: 'example' } },
          spec: {
            restartPolicy: 'OnFailure',
            containers: [
              {
                name: 'example',
                image: 'busybox:latest',
                command: ['sh', '-c', 'date; echo Hello from CronJob'],
              },
            ],
          },
        },
      },
    },
  },
});
