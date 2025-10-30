import { Badge } from '@/components/ui/badge';

interface BadgeNamespacesProps {
  name: string;
}

export function BadgeNamespaces({ name }: BadgeNamespacesProps) {
  return (
    <div className="flex h-full items-center">
      <Badge>{name}</Badge>
    </div>
  );
}
