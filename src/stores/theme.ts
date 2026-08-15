import { createSignal, createEffect } from 'solid-js';

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'kumate.theme';

const readStored = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
};

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

const [theme, setThemeSignal] = createSignal<Theme>(readStored());
const [resolved, setResolved] = createSignal<'dark' | 'light'>('dark');

/**
 * Apply the theme by setting `data-theme` on `<html>`.
 *
 * The palette lives entirely in CSS variables (`src/index.css`), so switching is one
 * attribute write with no component re-render. This replaces `next-themes`, which was
 * installed but never imported — the previous implementation was an inline script in
 * `main.tsx` reading `localStorage` before React booted, purely to avoid a flash.
 * That trick is still needed and now lives in `index.html`.
 */
const apply = (value: Theme) => {
  const effective = value === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : value;
  document.documentElement.dataset.theme = effective;
  setResolved(effective);
};

createEffect(() => {
  const value = theme();
  localStorage.setItem(STORAGE_KEY, value);
  apply(value);
});

// Follow the OS while in `system` mode.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme() === 'system') apply('system');
});

export { theme, resolved as resolvedTheme };

export const setTheme = (value: Theme) => setThemeSignal(value);

export const toggleTheme = () => setThemeSignal(resolved() === 'dark' ? 'light' : 'dark');
