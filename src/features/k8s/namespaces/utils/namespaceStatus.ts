import { BadgeVariant } from '@/types/variant';
import { V1Namespace } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getNamespaceStatus = (ns: V1Namespace): K8sStatus => {
  const phase = ns.status?.phase || 'Unknown';

  let variant: BadgeVariant = 'default';
  switch (phase) {
    case 'Active':
      variant = 'success';
      break;
    case 'Terminating':
      variant = 'warning';
      break;
    default:
      variant = 'default';
  }

  return { status: phase, variant };
};
