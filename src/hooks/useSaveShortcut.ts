import { useEffect } from 'react';

export function useSaveShortcut(enabled: boolean, onSave: () => void | Promise<void>) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (enabled) {
          void onSave();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onSave]);
}
