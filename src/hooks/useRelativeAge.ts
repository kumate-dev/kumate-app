import { useEffect, useState } from 'react';
import { relativeAge } from '@/utils/time';

export function useRelativeAge(iso?: string, intervalMs = 60000) {
  const [age, setAge] = useState(() => relativeAge(iso));

  useEffect(() => {
    if (!iso) return;
    const update = () => setAge(relativeAge(iso));
    update();
    const timer = setInterval(update, intervalMs);
    return () => clearInterval(timer);
  }, [iso, intervalMs]);

  return age;
}
