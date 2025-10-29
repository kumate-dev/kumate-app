import { BadgeVariant } from '@/types/variant';
import { V1Job } from '@kubernetes/client-node';
import { K8sStatus } from '@/types/k8sStatus';

export const getJobStatus = (job: V1Job): K8sStatus => {
  const succeeded = job.status?.succeeded ?? 0;
  const completions = job.spec?.completions ?? 0;
  const failed = job.status?.failed ?? 0;

  let status = 'Unknown';
  let variant: BadgeVariant = 'default';

  if (failed > 0) {
    status = 'Failed';
    variant = 'error';
  } else if (completions > 0) {
    if (succeeded >= completions) {
      status = 'Completed';
      variant = 'success';
    } else {
      status = 'In Progress';
      variant = 'warning';
    }
  } else if (succeeded > 0) {
    status = 'Completed';
    variant = 'success';
  } else {
    status = 'Pending';
    variant = 'default';
  }

  return { status, variant };
};
