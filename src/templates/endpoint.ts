import type { V1Endpoints } from '@kubernetes/client-node';

export function templateEndpoint(namespace?: string): V1Endpoints {
  return {
    apiVersion: 'v1',
    kind: 'Endpoints',
    metadata: {
      name: 'example-endpoints',
      namespace,
    },
    subsets: [
      {
        addresses: [{ ip: '10.0.0.1' }],
        ports: [{ port: 80, protocol: 'TCP' }],
      },
    ],
  } as V1Endpoints;
}
