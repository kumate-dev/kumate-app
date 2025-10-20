import { Icon } from '../ui';

export function IconNode(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l6-3 6 3v8l-6 3-6-3V8" />
    </Icon>
  );
}
