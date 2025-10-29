import { BadgeVariant } from '@/types/variant';
import { V1PodDisruptionBudget } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getPodDisruptionBudgetsStatus = (pdb: V1PodDisruptionBudget): K8sStatus => {
  const conditionType = pdb.status?.conditions?.[0]?.type ?? 'Unknown';

  let variant: BadgeVariant = 'default';
  switch (conditionType) {
    case 'Healthy':
      variant = 'success';
      break;
    case 'Degraded':
      variant = 'warning';
      break;
    case 'Blocked':
      variant = 'error';
      break;
    default:
      variant = 'default';
  }

  return { status: conditionType, variant };
};
