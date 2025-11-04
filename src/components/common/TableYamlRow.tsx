import { Td, Tr } from '@/components/ui/table';
import { YamlCollapsible } from './YamlCollapsible';

interface TableYamlRowProps<T extends Record<string, any>> {
  label: string;
  data: T | string | null | undefined;
  maxWidth?: string;
  maxWidthClass?: 'sm' | 'md' | 'lg' | 'xl';
}

export function TableYamlRow<T extends Record<string, any>>({
  label,
  data,
  maxWidth,
  maxWidthClass = 'md',
}: TableYamlRowProps<T>) {
  const widthClassMap: Record<NonNullable<TableYamlRowProps<T>['maxWidthClass']>, string> = {
    sm: 'max-w-[240px]',
    md: 'max-w-[300px]',
    lg: 'max-w-[480px]',
    xl: 'max-w-[640px]',
  };
  const appliedMaxWClass = widthClassMap[maxWidthClass];
  return (
    <Tr>
      <Td className="w-1/4 align-middle text-white/70">{label}</Td>
      <Td
        className={`w-3/4 overflow-hidden align-middle ${appliedMaxWClass}`}
        style={maxWidth && !maxWidthClass ? { maxWidth } : undefined}
      >
        <YamlCollapsible label={label} data={data} />
      </Td>
    </Tr>
  );
}
