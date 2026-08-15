/**
 * Keyboard shortcut chip.
 *
 * Accepts a shortcut in one canonical form — `'mod+k'`, `'shift+alt+f'`, `['esc']` —
 * and renders it the way the host OS writes it: `⌘K` on Apple, `Ctrl+K` elsewhere.
 * `mod` is the point of the whole component; call sites never branch on platform.
 *
 * Platform detection reads `navigator.platform`. It is deprecated, but it is present
 * in every WebView Tauri ships on, and `navigator.userAgentData` is not (WebKitGTK and
 * WKWebView both omit it). The user agent is checked as a second opinion.
 *
 * The rendered glyphs are decorative: `⌘⇧P` read aloud is noise, so the element carries
 * a spelled-out `aria-label` instead.
 */

import { splitProps, type JSX } from 'solid-js';

import { cn } from '@/lib/k8s';

const detectApple = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform) || /mac os x/i.test(navigator.userAgent);
};

/** True on macOS/iPadOS. Computed once: the host OS does not change mid-session. */
export const IS_APPLE_PLATFORM = detectApple();

const APPLE_GLYPHS: Record<string, string> = {
  mod: '⌘',
  cmd: '⌘',
  command: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  esc: '⎋',
  escape: '⎋',
  backspace: '⌫',
  delete: '⌦',
  del: '⌦',
  tab: '⇥',
  space: '␣',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

const OTHER_GLYPHS: Record<string, string> = {
  mod: 'Ctrl',
  cmd: 'Ctrl',
  command: 'Ctrl',
  meta: 'Win',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  enter: 'Enter',
  return: 'Enter',
  esc: 'Esc',
  escape: 'Esc',
  backspace: 'Backspace',
  delete: 'Del',
  del: 'Del',
  tab: 'Tab',
  space: 'Space',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

const SPOKEN: Record<string, string> = {
  mod: IS_APPLE_PLATFORM ? 'Command' : 'Control',
  cmd: 'Command',
  command: 'Command',
  meta: IS_APPLE_PLATFORM ? 'Command' : 'Windows',
  ctrl: 'Control',
  control: 'Control',
  alt: IS_APPLE_PLATFORM ? 'Option' : 'Alt',
  option: 'Option',
  shift: 'Shift',
  esc: 'Escape',
  escape: 'Escape',
  del: 'Delete',
  up: 'Up arrow',
  down: 'Down arrow',
  left: 'Left arrow',
  right: 'Right arrow',
};

const titleCase = (key: string) =>
  key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'h-4 min-w-4 px-1 text-2xs',
  md: 'h-5 min-w-5 px-1.5 text-2xs',
};

export interface KbdProps extends JSX.HTMLAttributes<HTMLElement> {
  /** `'mod+k'` or `['mod', 'k']`. Case-insensitive. */
  keys: string | string[];
  size?: 'sm' | 'md';
}

export function Kbd(props: KbdProps) {
  const [local, others] = splitProps(props, ['keys', 'size', 'class']);

  const parts = () =>
    (Array.isArray(local.keys) ? local.keys : local.keys.split('+'))
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0);

  // Built as a string, not a list of nodes: `⌘K` is one word visually, and a chip per
  // modifier would be four bordered boxes where the OS draws one.
  const glyphs = () =>
    parts()
      .map((key) => (IS_APPLE_PLATFORM ? APPLE_GLYPHS[key] : OTHER_GLYPHS[key]) ?? titleCase(key))
      .join(IS_APPLE_PLATFORM ? '' : '+');

  const spoken = () =>
    parts()
      .map((key) => SPOKEN[key] ?? titleCase(key))
      .join(' plus ');

  return (
    <kbd
      aria-label={spoken()}
      class={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xs border select-none',
        'border-[var(--border-default)] bg-[var(--surface-inset)] font-sans font-medium',
        'text-[var(--text-tertiary)]',
        SIZE[local.size ?? 'md'],
        local.class
      )}
      {...others}
    >
      {glyphs()}
    </kbd>
  );
}
