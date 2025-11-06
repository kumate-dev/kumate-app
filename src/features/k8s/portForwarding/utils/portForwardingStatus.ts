import { BadgeVariant } from '@/types/variant';
import { K8sStatus } from '@/types/k8sStatus';

const portForwardingStatusVariant = (s?: string): BadgeVariant => {
  switch (s) {
    case 'Running':
      return 'success';
    case 'Stopped':
      return 'error';
    default:
      return 'default';
  }
};

export const getPortForwardingStatus = (status: string): K8sStatus => {
  const variant = portForwardingStatusVariant(status);
  return { status, variant };
};
