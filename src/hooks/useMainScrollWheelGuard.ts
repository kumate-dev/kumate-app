import { useCallback } from 'react';

export function useMainScrollWheelGuard() {
  const handleMainWheelCapture = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const canScroll = el.scrollHeight > el.clientHeight;

    if (!canScroll) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    const delta = e.deltaY;
    const atTop = el.scrollTop <= 0;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

    if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return { handleMainWheelCapture };
}