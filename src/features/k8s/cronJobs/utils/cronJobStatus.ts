import { K8sStatus } from '@/types/k8sStatus';
import { BadgeVariant } from '@/types/variant';
import { V1CronJob } from '@kubernetes/client-node';

const statusVariant = (status: string) => {
  if (status === 'Suspend') return 'warning';
  if (status === 'Active') return 'success';
  return 'default';
};

export const getCronJobStatus = (cj: V1CronJob): K8sStatus => {
  const status = cj.spec?.suspend === true ? 'Suspend' : 'Active';
  const variant: BadgeVariant = statusVariant(status);

  return { status, variant };
};
