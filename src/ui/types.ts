/**
 * Types shared by more than one primitive in this layer.
 *
 * There are exactly two, and both exist to avoid a worse alternative:
 *
 * - `IconComponent` is deliberately *not* `lucide-solid`'s own `LucideProps`. Typing
 *   every icon slot against one icon package would make swapping or hand-rolling an
 *   icon a type error, and the four props below are all an icon slot ever sets. A
 *   `lucide-solid` icon satisfies this structurally, so `icon={Search}` needs no cast.
 *
 * - `Placement` mirrors the Floating UI placement strings that Kobalte's popper takes.
 *   Re-declaring it keeps `@kobalte/core/popper` — an internal subpath — out of our
 *   import graph.
 */

import type { Component } from 'solid-js';

export interface IconProps {
  size?: number | string;
  class?: string;
  strokeWidth?: number | string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

/** Any icon that can be dropped into an `icon` slot. */
export type IconComponent = Component<IconProps>;

/** Where a floating surface (tooltip, menu, select listbox) prefers to sit. */
export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end';
