import { relativeAge } from '@/utils/time';
import { useEffect, useState } from 'react';

interface RelativeAgeProps {
  iso?: string;
}

export function RelativeAge({ iso }: RelativeAgeProps) {
  const [age, setAge] = useState(() => relativeAge(iso));

  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => {
      setAge(relativeAge(iso));
    }, 1000);
    return () => clearInterval(id);
  }, [iso]);

  return <span>{age}</span>;
}
