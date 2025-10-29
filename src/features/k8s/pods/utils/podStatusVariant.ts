import { BadgeVariant } from '@/types/variant';

export const podStatusVariant = (s?: string): BadgeVariant => {
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
