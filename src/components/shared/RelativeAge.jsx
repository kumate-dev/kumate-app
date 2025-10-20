import { relativeAge } from '../../utils/time';

import { useEffect, useState } from 'react';

export function RelativeAge({ iso }) {
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
