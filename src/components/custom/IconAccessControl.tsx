import { Icon } from '@/components/ui/icon';

export function IconAccessControl(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10V8a4 4 0 018 0v2m-10 0h12v8H6v-8z"
      />
    </Icon>
  );
}
