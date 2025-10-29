import { BadgeVariant } from '@/types/variant';
import { V1StatefulSet } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getStatefulSetStatus = (ss: V1StatefulSet): K8sStatus => {
  const ready = ss.status?.readyReplicas ?? 0;
  const desired = ss.status?.replicas ?? 0;
  const status = `${ready}/${desired}`;

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
