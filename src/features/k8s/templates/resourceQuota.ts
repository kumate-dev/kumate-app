import { V1ResourceQuota } from '@kubernetes/client-node';

export function templateResourceQuota(defaultNamespace?: string): V1ResourceQuota {
  return {
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: {
      name: 'example-resourcequota',
      namespace: defaultNamespace,
    },
    spec: {
      hard: {
        'requests.cpu': '1',
        'requests.memory': '1Gi',
        'limits.cpu': '2',
        'limits.memory': '2Gi',
        pods: '10',
      },
    },
  } as V1ResourceQuota;
}
