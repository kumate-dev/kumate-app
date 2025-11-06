import type { V1Namespace } from '@kubernetes/client-node';

export const templateNamespace: V1Namespace = {
  apiVersion: 'v1',
  kind: 'Namespace',
  metadata: {
    name: 'example-namespace',
  },
};
