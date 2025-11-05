import type { V1StorageClass } from '@kubernetes/client-node';

export function templateStorageClass(): V1StorageClass {
  return {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: {
      name: 'standard',
    },
    provisioner: 'kubernetes.io/no-provisioner',
    volumeBindingMode: 'WaitForFirstConsumer',
    allowVolumeExpansion: true,
    parameters: {},
  } as unknown as V1StorageClass;
}
