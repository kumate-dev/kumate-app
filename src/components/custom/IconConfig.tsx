import { Icon } from '@/components/ui/icon';

export function IconConfig(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 8.25h10.5M4.5 12h15M4.5 15.75h8.25"
      />
    </Icon>
  );
}
