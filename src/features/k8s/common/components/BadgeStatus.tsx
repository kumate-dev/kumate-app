import { Badge } from '@/components/ui/badge';
import { K8sStatus } from '@/types/k8sStatus';

export interface BadgeStatusProps {
  status: K8sStatus;
}

export function BadgeStatus({ status }: BadgeStatusProps) {
  return <Badge variant={status.variant}>{status.status ?? 'Unknown'}</Badge>;
}
