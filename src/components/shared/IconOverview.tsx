import { Icon } from '../ui';

export function IconOverview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 4.5h6v6h-6zM14.25 4.5h6v6h-6zM3.75 14.25h6v6h-6zM14.25 14.25h6v6h-6z"
      />
    </Icon>
  );
}
