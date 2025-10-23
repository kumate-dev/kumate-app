import { Badge } from '@/components/ui/badge';
import { Td } from '@/components/ui/table';

interface BadgeK8sNamespacesProps {
  name: string;
}

export function BadgeK8sNamespaces({ name }: BadgeK8sNamespacesProps) {
  return (
    <Td>
      <Badge>{name}</Badge>
    </Td>
  );
}
