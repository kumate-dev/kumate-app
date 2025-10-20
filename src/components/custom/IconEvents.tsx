import { Icon } from '../ui';

export function IconEvents(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6l4 2M12 3a9 9 0 110 18 9 9 0 010-18"
      />
    </Icon>
  );
}
