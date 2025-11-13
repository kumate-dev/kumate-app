import React from 'react';

/**
 * Compute dynamic max width for the hotbar based on the longest cluster display name.
 * - Measures text width at 12px (Tailwind text-xs) using canvas when possible, with a fallback
 * - Adds layout paddings and avatar size to ensure the full label fits
 * - Clamps within [minWidth, maxCap]
 */
export const useDynamicHotbarMaxWidth = (
  clusters: { name: string; displayName?: string }[],
  minWidth: number,
  maxCap: number
) => {
  return React.useMemo(() => {
    const longestLabel = clusters.reduce((longest, c) => {
      const label = c.displayName || c.name || '';
      return label.length > longest.length ? label : longest;
    }, '');

    // Estimate text width at 12px (Tailwind text-xs)
    let textWidth = longestLabel.length * 7; // fallback ~7px per char
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.font =
            '12px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
          textWidth = ctx.measureText(longestLabel).width;
        }
      } catch {}
    }

    // Layout paddings and avatar size
    const CONTAINER_PL = 8; // pl-2
    const CONTAINER_PR = 12; // pr-3
    const BUTTON_PX = 16; // px-2 (both sides)
    const AVATAR_WIDTH = 36; // w-9
    const LABEL_MARGIN_LEFT = 8; // ml-2
    const EXTRA_BUFFER = 24; // breathing room

    const base =
      CONTAINER_PL + CONTAINER_PR + BUTTON_PX + AVATAR_WIDTH + LABEL_MARGIN_LEFT + EXTRA_BUFFER;
    const computed = Math.ceil(base + textWidth);
    return Math.min(Math.max(computed, minWidth), maxCap);
  }, [clusters, minWidth, maxCap]);
};
