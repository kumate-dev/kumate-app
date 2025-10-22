import { Icon } from '@/components/ui/icon';

export function IconNetwork(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9zm0 0c2.5 2.5 2.5 15.5 0 18m0 0c-2.5-2.5-2.5-15.5 0-18M3 12h18"
      />
    </Icon>
  );
}
