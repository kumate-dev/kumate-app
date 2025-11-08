import { V1ResourceQuota } from '@kubernetes/client-node';

export function templateResourceQuota(name?: string, namespace?: string): V1ResourceQuota {
  return {
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: {
      name: name || 'example-resourcequota',
      namespace: namespace || 'default',
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
