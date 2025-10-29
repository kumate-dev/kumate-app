import { Badge } from '@/components/ui/badge';
import { podStatusVariant } from '../utils/podStatusVariant';

interface BadgePodStatusProps {
  status?: string;
}
export function BadgePodStatus({ status }: BadgePodStatusProps) {
  const variant = podStatusVariant(status);
  return <Badge variant={variant}>{status ?? 'Unknown'}</Badge>;
}
