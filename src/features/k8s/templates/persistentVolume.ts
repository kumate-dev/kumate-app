import type { V1PersistentVolume } from '@kubernetes/client-node';

export function templatePersistentVolume(): V1PersistentVolume {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: {
      name: 'example-pv',
    },
    spec: {
      capacity: { storage: '8Gi' },
      accessModes: ['ReadWriteOnce'],
      persistentVolumeReclaimPolicy: 'Retain',
      volumeMode: 'Filesystem',
      storageClassName: 'standard',
      hostPath: { path: '/mnt/data' },
    },
  } as V1PersistentVolume;
}