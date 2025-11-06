import type { V1ClusterRoleBinding } from '@kubernetes/client-node';

export function templateClusterRoleBinding(): V1ClusterRoleBinding {
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: {
      name: 'example-cluster-role-binding',
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
      kind: 'ClusterRole',
      name: 'example-cluster-role',
    },
  } as V1ClusterRoleBinding;
}
