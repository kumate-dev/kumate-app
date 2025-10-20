import { Icon } from "../ui";

export function IconSecrets(props: React.SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25a3.75 3.75 0 10-7.5 0 3.75 3.75 0 007.5 0z"/>
      <path d="M12 9v12M8.25 14.25h7.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}
