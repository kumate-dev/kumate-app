import { Badge } from '@/components/ui/badge';

interface BadgeK8sNamespacesProps {
  name: string;
}

export function BadgeK8sNamespaces({ name }: BadgeK8sNamespacesProps) {
  return (
    <div className="flex h-full items-center">
      <Badge>{name}</Badge>
    </div>
  );
}
