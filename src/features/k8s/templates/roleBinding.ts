import type { V1RoleBinding } from '@kubernetes/client-node';

export const templateRoleBinding = (namespace?: string): V1RoleBinding => ({
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'RoleBinding',
  metadata: {
    name: 'example-role-binding',
    namespace: namespace ?? 'default',
  },
  subjects: [
    {
      kind: 'User',
      name: 'example-user',
      apiGroup: 'rbac.authorization.k8s.io',
    },
  ],
  roleRef: {
    apiGroup: 'rbac.authorization.k8s.io',
    kind: 'Role',
    name: 'example-role',
  },
});
