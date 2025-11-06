import type { V1NetworkPolicy } from '@kubernetes/client-node';

export function templateNetworkPolicy(namespace?: string): V1NetworkPolicy {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'example-network-policy', namespace },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress', 'Egress'],
      ingress: [
        {
          _from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
        },
      ],
      egress: [
        {
          to: [{ podSelector: { matchLabels: { app: 'backend' } } }],
        },
      ],
    },
  } as V1NetworkPolicy;
}
