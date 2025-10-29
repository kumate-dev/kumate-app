import { K8sStatus } from '@/types/k8sStatus';
import { BadgeVariant } from '@/types/variant';
import { V1HorizontalPodAutoscaler } from '@kubernetes/client-node';

function statusVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'Active':
    case 'AbleToScale':
      return 'success';
    case 'Error':
    case 'Failed':
      return 'error';
    case 'Unknown':
    default:
      return 'default';
  }
}

export const getHorizontalPodAutoscalerStatus = (hpa: V1HorizontalPodAutoscaler): K8sStatus => {
  const conditions = (hpa.status as any)?.conditions as
    | { type?: string; status?: string }[]
    | undefined;

  let status = 'Unknown';

  if (conditions && conditions.length > 0) {
    for (const cond of conditions) {
      const type = cond.type;
      const condStatus = cond.status;

      if (type === 'ScalingActive' && condStatus === 'True') {
        status = 'Active';
        break;
      }
      if (type === 'ScalingActive' && condStatus === 'False') {
        status = 'Error';
        break;
      }
      if (type === 'AbleToScale' && condStatus === 'True') {
        status = 'AbleToScale';
        break;
      }
      if (type === 'AbleToScale' && condStatus === 'False') {
        status = 'Failed';
        break;
      }
    }
  }

  let variant: BadgeVariant = statusVariant(status);

  return { status, variant };
};
