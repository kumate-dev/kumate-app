import { V1Lease } from '@kubernetes/client-node';

export const templateLease = (namespace?: string): V1Lease => ({
  apiVersion: 'coordination.k8s.io/v1',
  kind: 'Lease',
  metadata: {
    name: 'example-lease',
    namespace: namespace ?? 'default',
    labels: { app: 'example' },
  },
  spec: {
    holderIdentity: 'example-holder',
    leaseDurationSeconds: 30,
  },
});
