import type { V1ServiceAccount } from '@kubernetes/client-node';

export const templateServiceAccount = (namespace?: string): V1ServiceAccount => ({
  apiVersion: 'v1',
  kind: 'ServiceAccount',
  metadata: {
    name: 'example-service-account',
    namespace: namespace ?? 'default',
  },
  secrets: [],
  imagePullSecrets: [],
  automountServiceAccountToken: true,
});
