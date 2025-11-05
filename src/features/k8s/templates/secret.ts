import { V1Secret } from '@kubernetes/client-node';

export function templateSecret(defaultNamespace?: string): V1Secret {
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: 'example-secret',
      namespace: defaultNamespace,
    },
    type: 'Opaque',
    stringData: {
      username: 'admin',
      password: 'changeme',
    },
  } as V1Secret;
}
