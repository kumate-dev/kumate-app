import { relativeAge } from '@/utils/time';
import { useEffect, useState, useCallback } from 'react';

interface RelativeAgeProps {
  iso?: string;
}

export function RelativeAge({ iso }: RelativeAgeProps) {
  const [age, setAge] = useState(() => relativeAge(iso));

  const updateAge = useCallback(() => {
    setAge(relativeAge(iso));
  }, [iso]);

  useEffect(() => {
    if (!iso) return;

    updateAge();
    const id = setInterval(updateAge, 1000);

    return () => clearInterval(id);
  }, [iso, updateAge]);

  return <span>{age}</span>;
}
