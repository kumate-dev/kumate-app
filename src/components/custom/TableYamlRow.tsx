import { Td, Tr } from '@/components/ui/table';
import { CollapsibleYaml } from './CollapsibleYaml';

interface TableYamlRowProps<T extends Record<string, any>> {
  label: string;
  data: T | string | null | undefined;
  maxWidth?: string;
}

export function TableYamlRow<T extends Record<string, any>>({
  label,
  data,
  maxWidth = '300px',
}: TableYamlRowProps<T>) {
  return (
    <Tr>
      <Td className="w-1/4 align-middle text-white/70">{label}</Td>
      <Td className={`overflow-x-auto max-w-[${maxWidth}]`}>
        <CollapsibleYaml label={label} data={data} />
      </Td>
    </Tr>
  );
}
