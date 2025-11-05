import { V1ConfigMap } from '@kubernetes/client-node';

export function templateConfigMap(defaultNamespace?: string): V1ConfigMap {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: 'example-configmap',
      namespace: defaultNamespace,
    },
    data: {
      'example.key': 'example value',
    },
  } as V1ConfigMap;
}
