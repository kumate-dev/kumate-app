import { K8sStatus } from '@/types/k8sStatus';
import { BadgeVariant } from '@/types/variant';
import { V1Secret } from '@kubernetes/client-node';

export const getSecretTypeStatus = (secret: V1Secret): K8sStatus => {
  const type = secret.type ?? '-';

  let variant: BadgeVariant = 'default';
  switch (type) {
    case 'Opaque':
      variant = 'secondary';
      break;
    case 'kubernetes.io/service-account-token':
      variant = 'warning';
      break;
    case 'kubernetes.io/dockerconfigjson':
      variant = 'success';
      break;
    case 'kubernetes.io/tls':
      variant = 'error';
      break;
    default:
      variant = 'default';
  }

  return { status: type, variant };
};
