import type { V1Role } from '@kubernetes/client-node';

export const templateRole = (namespace?: string): V1Role => ({
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'Role',
  metadata: {
    name: 'example-role',
    namespace: namespace ?? 'default',
  },
  rules: [
    {
      apiGroups: [''],
      resources: ['pods'],
      verbs: ['get', 'list', 'watch'],
    },
  ],
});
