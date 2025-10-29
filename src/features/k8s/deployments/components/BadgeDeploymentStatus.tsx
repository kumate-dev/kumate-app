import { Badge } from '@/components/ui/badge';
import { statusVariant } from '../utils/statusVariant';

interface BadgeDeploymentStatusProps {
  status?: string;
}

export function BadgeDeploymentStatus({ status }: BadgeDeploymentStatusProps) {
  const variant = statusVariant(status);
  return <Badge variant={variant}>{status ?? 'Unknown'}</Badge>;
}
