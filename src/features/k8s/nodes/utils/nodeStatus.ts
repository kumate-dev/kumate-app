import { BadgeVariant } from '@/types/variant';
import { V1Node } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getNodeStatus = (node: V1Node): K8sStatus => {
  const conditions = node.status?.conditions;
  if (!conditions) return { status: 'Unknown', variant: 'warning' };

  const readyCond = conditions.find((c) => c.type === 'Ready');
  if (!readyCond) return { status: 'Unknown', variant: 'warning' };

  let status = 'Unknown';
  let variant: BadgeVariant = 'warning';

  switch (readyCond.status) {
    case 'True':
      status = 'Ready';
      variant = 'success';
      break;
    case 'Unknown':
      status = 'Unknown';
      variant = 'warning';
      break;
    default:
      status = 'NotReady';
      variant = 'error';
  }

  return { status, variant };
};
