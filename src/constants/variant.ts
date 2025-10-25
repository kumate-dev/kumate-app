import { BadgeVariant } from '@/types/variant';

export const k8sDeploymentStatusVariant = (s: string): BadgeVariant => {
  switch (s) {
    case 'Available':
      return 'success';
    case 'Progressing':
    case 'Scaling':
      return 'warning';
    case 'Terminating':
      return 'secondary';
    case 'Failed':
    case 'Unavailable':
      return 'error';
    default:
      return 'default';
  }
};
