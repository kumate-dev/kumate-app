import { V1Pod } from '@kubernetes/client-node';

export const templatePod = (namespace?: string): V1Pod => ({
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: {
    name: 'example-pod',
    namespace: namespace ?? 'default',
  },
  spec: {
    containers: [
      {
        name: 'example',
        image: 'nginx:latest',
        ports: [{ containerPort: 80 }],
      },
    ],
  },
});
