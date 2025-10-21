import { useEffect, useRef } from "react";
import { relativeAge } from "../../utils/time";
import { Td } from "../ui";

export default function AgeCell({ timestamp }: { timestamp: string }) {
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      el.textContent = relativeAge(timestamp);
    };

    update();
    const id = setInterval(update, 1000);

    return () => clearInterval(id);
  }, [timestamp]);

  return (
    <Td
      ref={ref}
      className="text-white/80"
      style={{
        minWidth: '70px',
      }}
    />
  );
}
