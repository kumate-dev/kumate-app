import { Icon } from '@/components/ui/icon';

export function IconNamespaces(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 7h6v6H5V7zm8 0h6v6h-6V7zm-8 8h6v6H5v-6zm8 0h6v6h-6v-6z"
      />
    </Icon>
  );
}
