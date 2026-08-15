/**
 * Inline loading spinner.
 *
 * Plain SVG stroked with `currentColor`, so it inherits whatever it is dropped into —
 * a Button's label colour, a Badge's status hue — and needs no variant prop.
 *
 * There is no size scale: a spinner is always sized to the glyph beside it, so callers
 * pass pixels. It is intentionally *not* a `lucide` icon; `Loader2` costs a module
 * import for a shape that is nine lines of SVG.
 */

import { splitProps, type JSX } from 'solid-js';

import { cn } from '@/lib/k8s';

export interface SpinnerProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  /** Edge length in pixels. Defaults to 14, which lines up with 13px body text. */
  size?: number | string;
}

export function Spinner(props: SpinnerProps) {
  const [local, others] = splitProps(props, ['size', 'class']);

  return (
    <svg
      viewBox="0 0 16 16"
      width={local.size ?? 14}
      height={local.size ?? 14}
      fill="none"
      aria-hidden="true"
      class={cn('shrink-0 animate-spin', local.class)}
      {...others}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="2" opacity="0.25" />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}
