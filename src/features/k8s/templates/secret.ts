import { V1Secret } from '@kubernetes/client-node';

export function templateSecret(name?: string, namespace?: string): V1Secret {
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: name || 'example-secret',
      namespace: namespace || 'default',
    },
    type: 'Opaque',
    stringData: {
      username: 'admin',
      password: 'changeme',
    },
  } as V1Secret;
}
