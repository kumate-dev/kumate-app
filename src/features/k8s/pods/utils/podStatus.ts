import { BadgeVariant } from '@/types/variant';
import { V1Pod } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

const podStatusVariant = (s?: string): BadgeVariant => {
  switch (s) {
    case 'Pending':
    case 'ContainerCreating':
      return 'warning';
    case 'Running':
      return 'success';
    case 'Failed':
    case 'CrashLoopBackOff':
    case 'ImagePullBackOff':
    case 'ErrImagePull':
    case 'OOMKilled':
      return 'error';
    case 'Succeeded':
    case 'Terminating':
    default:
      return 'default';
  }
};

export const getPodStatus = (pod: V1Pod): K8sStatus => {
  const status = pod.status?.phase ?? 'Unknown';
  const variant = podStatusVariant(status);
  return { status, variant };
};
