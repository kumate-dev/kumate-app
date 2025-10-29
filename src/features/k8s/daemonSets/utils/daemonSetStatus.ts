import { BadgeVariant } from '@/types/variant';
import { V1DaemonSet } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getDaemonSetStatus = (ds: V1DaemonSet): K8sStatus => {
  const ready = ds.status?.numberReady ?? 0;
  const desired = ds.status?.desiredNumberScheduled ?? 0;

  let status = `${ready} / ${desired}`;
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
