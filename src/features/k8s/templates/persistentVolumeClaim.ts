import { V1PersistentVolumeClaim } from '@kubernetes/client-node';

export const templatePersistentVolumeClaim = (
  namespace?: string
): V1PersistentVolumeClaim => ({
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaim',
  metadata: {
    name: 'example-pvc',
    namespace: namespace ?? 'default',
  },
  spec: {
    accessModes: ['ReadWriteOnce'],
    resources: {
      requests: {
        storage: '1Gi',
      },
    },
  },
} as unknown as V1PersistentVolumeClaim);