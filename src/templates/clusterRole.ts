import type { V1ClusterRole } from '@kubernetes/client-node';

export function templateClusterRole(): V1ClusterRole {
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: {
      name: 'example-cluster-role',
    },
    rules: [
      {
        apiGroups: [''],
        resources: ['pods'],
        verbs: ['get', 'list', 'watch'],
      },
    ],
  } as V1ClusterRole;
}
