import { RefObject, useEffect } from 'react';

export function useAutoSaveOnOutsideClick(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onSave: () => void | Promise<void>
) {
  useEffect(() => {
    if (!enabled) return;

    const handleDocClick = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      const clickedInside = !!target && el.contains(target);
      if (!clickedInside) {
        void onSave();
      }
    };

    document.addEventListener('mousedown', handleDocClick, true);
    return () => document.removeEventListener('mousedown', handleDocClick, true);
  }, [enabled, containerRef, onSave]);
}