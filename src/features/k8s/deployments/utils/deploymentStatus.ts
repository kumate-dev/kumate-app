import { BadgeVariant } from '@/types/variant';
import { V1Deployment } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getDeploymentStatus = (dep: V1Deployment): K8sStatus => {
  const status = dep.status?.conditions?.[0]?.type ?? 'Unknown';

  let variant: BadgeVariant = 'default';
  switch (status) {
    case 'Progressing':
      variant = 'warning';
      break;
    case 'Available':
      variant = 'success';
      break;
    case 'Failed':
      variant = 'error';
      break;
    default:
      variant = 'default';
  }

  return { status, variant };
};
