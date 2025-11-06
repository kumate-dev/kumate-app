import { useEffect, useRef, useCallback } from 'react';
import { relativeAge } from '@/utils/time';
import { Td } from '@/components/ui/table';

export default function AgeCell({ timestamp }: { timestamp?: string | Date }) {
  const ref = useRef<HTMLTableCellElement>(null);

  const updateAge = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    let tsStr: string | undefined;
    if (!timestamp) {
      tsStr = undefined;
    } else if (timestamp instanceof Date) {
      tsStr = timestamp.toISOString();
    } else {
      tsStr = timestamp;
    }

    el.textContent = tsStr ? relativeAge(tsStr) : '-';
  }, [timestamp]);

  useEffect(() => {
    updateAge();
    const id = setInterval(updateAge, 1000);

    return () => clearInterval(id);
  }, [updateAge]);

  return <Td ref={ref} className="min-w-[70px] text-white/80" />;
}
