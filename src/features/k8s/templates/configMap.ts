import { V1ConfigMap } from '@kubernetes/client-node';

export function templateConfigMap(name?: string, namespace?: string): V1ConfigMap {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: name || 'example-configmap',
      namespace: namespace || 'default',
    },
    data: {
      'example.key': 'example value',
    },
  } as V1ConfigMap;
}
