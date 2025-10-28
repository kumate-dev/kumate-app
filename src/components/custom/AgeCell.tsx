import { useEffect, useRef } from 'react';
import { relativeAge } from '@/utils/time';
import { Td } from '@/components/ui/table';

export default function AgeCell({ timestamp }: { timestamp?: string | Date }) {
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      let tsStr: string | undefined;
      if (!timestamp) tsStr = undefined;
      else if (timestamp instanceof Date) tsStr = timestamp.toISOString();
      else tsStr = timestamp;

      el.textContent = tsStr ? relativeAge(tsStr) : '-';
    };

    update();
    const id = setInterval(update, 1000);

    return () => clearInterval(id);
  }, [timestamp]);

  return <Td ref={ref} className="text-white/80" style={{ minWidth: '70px' }} />;
}
