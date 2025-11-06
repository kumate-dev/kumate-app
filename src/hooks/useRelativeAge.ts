import { useEffect, useState, useCallback } from 'react';
import { relativeAge } from '@/utils/time';

export function useRelativeAge(iso?: string, intervalMs = 60000) {
  const [age, setAge] = useState(() => relativeAge(iso));

  const updateAge = useCallback(() => {
    setAge(relativeAge(iso));
  }, [iso]);

  useEffect(() => {
    if (!iso) return;

    updateAge();

    const timer = setInterval(updateAge, intervalMs);
    return () => clearInterval(timer);
  }, [iso, intervalMs, updateAge]);

  return age;
}
