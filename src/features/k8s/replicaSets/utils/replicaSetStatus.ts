import { BadgeVariant } from '@/types/variant';
import { V1ReplicaSet } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getReplicaSetStatus = (rs: V1ReplicaSet): K8sStatus => {
  const ready = rs.status?.readyReplicas ?? 0;
  const desired = rs.status?.replicas ?? 0;
  const status = `${ready} / ${desired}`;

  let variant: BadgeVariant = 'default';
  if (desired > 0) {
    if (ready === desired) {
      variant = 'success';
    } else if (ready > 0) {
      variant = 'warning';
    } else {
      variant = 'error';
    }
  }

  return { status, variant };
};
